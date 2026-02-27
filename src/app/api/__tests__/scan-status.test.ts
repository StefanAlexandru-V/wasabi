import { describe, it, expect, beforeEach } from "vitest";
import {
  mockPrisma,
  setAuthenticatedUser,
  resetMocks,
  TEST_IDS,
} from "@/__tests__/helpers/mocks";
import { GET } from "@/app/api/scan/[id]/status/route";
import { NextRequest } from "next/server";

function makeRequest(id: string) {
  return [
    new NextRequest(`http://localhost:3000/api/scan/${id}/status`),
    { params: Promise.resolve({ id }) },
  ] as const;
}

describe("GET /api/scan/:id/status", () => {
  beforeEach(() => {
    resetMocks();
  });

  it("returns 401 when unauthenticated", async () => {
    const [req, ctx] = makeRequest(TEST_IDS.scan1);
    const res = await GET(req, ctx);
    expect(res.status).toBe(401);
  });

  it("returns 404 when scan not found", async () => {
    setAuthenticatedUser({ id: TEST_IDS.user1 });
    mockPrisma.scan.findFirst.mockResolvedValue(null);

    const [req, ctx] = makeRequest(TEST_IDS.scan1);
    const res = await GET(req, ctx);
    expect(res.status).toBe(404);
  });

  it("returns scan status fields", async () => {
    setAuthenticatedUser({ id: TEST_IDS.user1 });
    mockPrisma.scan.findFirst.mockResolvedValue({
      id: TEST_IDS.scan1,
      status: "running",
      startedAt: new Date("2025-01-01"),
      completedAt: null,
      repoCount: 0,
    });

    const [req, ctx] = makeRequest(TEST_IDS.scan1);
    const res = await GET(req, ctx);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe(TEST_IDS.scan1);
    expect(body.status).toBe("running");
    expect(body.completedAt).toBeNull();
  });
});
