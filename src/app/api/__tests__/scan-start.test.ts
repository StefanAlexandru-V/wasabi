import { describe, it, expect, beforeEach } from "vitest";
import {
  mockPrisma,
  mockInngest,
  setAuthenticatedUser,
  setUserPlan,
  resetMocks,
  TEST_IDS,
} from "@/__tests__/helpers/mocks";
import { POST } from "@/app/api/scan/start/route";
import { NextRequest } from "next/server";

function makeRequest(body: Record<string, unknown>) {
  return new NextRequest("http://localhost:3000/api/scan/start", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/scan/start", () => {
  beforeEach(() => {
    resetMocks();
  });

  it("returns 401 when unauthenticated", async () => {
    const res = await POST(makeRequest({ orgId: TEST_IDS.org1 }));
    expect(res.status).toBe(401);
  });

  it("returns 400 when orgId is missing", async () => {
    setAuthenticatedUser({ id: TEST_IDS.user1 });
    const res = await POST(makeRequest({}));
    expect(res.status).toBe(400);
  });

  it("returns 404 when org not found or not owned by user", async () => {
    setAuthenticatedUser({ id: TEST_IDS.user1 });
    mockPrisma.organization.findFirst.mockResolvedValue(null);

    const res = await POST(makeRequest({ orgId: TEST_IDS.org1 }));
    expect(res.status).toBe(404);
  });

  it("returns 429 when free plan has scanned in last 24h", async () => {
    setAuthenticatedUser({ id: TEST_IDS.user1 });
    setUserPlan("free");
    mockPrisma.organization.findFirst.mockResolvedValue({
      id: TEST_IDS.org1,
      name: "test-org",
      ownerUserId: TEST_IDS.user1,
    });
    mockPrisma.scan.findFirst.mockResolvedValue({
      id: TEST_IDS.scan1,
      startedAt: new Date(),
    });

    const res = await POST(makeRequest({ orgId: TEST_IDS.org1 }));
    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body.error).toContain("24 hours");
  });

  it("creates scan and sends inngest event on success", async () => {
    setAuthenticatedUser({ id: TEST_IDS.user1 });
    setUserPlan("pro");
    mockPrisma.organization.findFirst.mockResolvedValue({
      id: TEST_IDS.org1,
      name: "test-org",
      ownerUserId: TEST_IDS.user1,
    });
    mockPrisma.scan.create.mockResolvedValue({
      id: TEST_IDS.scan1,
      orgId: TEST_IDS.org1,
      status: "queued",
    });
    mockInngest.send.mockResolvedValue(undefined);

    const res = await POST(makeRequest({ orgId: TEST_IDS.org1 }));
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.id).toBe(TEST_IDS.scan1);
    expect(body.status).toBe("queued");

    expect(mockPrisma.scan.create).toHaveBeenCalledWith({
      data: { orgId: TEST_IDS.org1, status: "queued" },
    });
    expect(mockInngest.send).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "scan/run",
        data: expect.objectContaining({
          scanId: TEST_IDS.scan1,
          orgId: TEST_IDS.org1,
          orgName: "test-org",
          userId: TEST_IDS.user1,
          plan: "pro",
        }),
      })
    );
  });

  it("allows free plan scan when no recent scan exists", async () => {
    setAuthenticatedUser({ id: TEST_IDS.user1 });
    setUserPlan("free");
    mockPrisma.organization.findFirst.mockResolvedValue({
      id: TEST_IDS.org1,
      name: "test-org",
      ownerUserId: TEST_IDS.user1,
    });
    mockPrisma.scan.findFirst.mockResolvedValue(null);
    mockPrisma.scan.create.mockResolvedValue({
      id: TEST_IDS.scan2,
      orgId: TEST_IDS.org1,
      status: "queued",
    });
    mockInngest.send.mockResolvedValue(undefined);

    const res = await POST(makeRequest({ orgId: TEST_IDS.org1 }));
    expect(res.status).toBe(200);
  });
});
