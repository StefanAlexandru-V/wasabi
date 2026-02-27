import { describe, it, expect, beforeEach } from "vitest";
import {
  mockPrisma,
  setAuthenticatedUser,
  resetMocks,
  TEST_IDS,
} from "@/__tests__/helpers/mocks";
import { DELETE } from "@/app/api/orgs/[orgId]/route";
import { NextRequest } from "next/server";

function makeRequest(orgId: string) {
  return [
    new NextRequest(`http://localhost:3000/api/orgs/${orgId}`, {
      method: "DELETE",
    }),
    { params: Promise.resolve({ orgId }) },
  ] as const;
}

describe("DELETE /api/orgs/:orgId", () => {
  beforeEach(() => {
    resetMocks();
  });

  it("returns 401 when unauthenticated", async () => {
    const [req, ctx] = makeRequest(TEST_IDS.org1);
    const res = await DELETE(req, ctx);
    expect(res.status).toBe(401);
  });

  it("returns 404 when org not found or not owned", async () => {
    setAuthenticatedUser({ id: TEST_IDS.user1 });
    mockPrisma.organization.findFirst.mockResolvedValue(null);

    const [req, ctx] = makeRequest(TEST_IDS.org1);
    const res = await DELETE(req, ctx);
    expect(res.status).toBe(404);
  });

  it("deletes org and returns success", async () => {
    setAuthenticatedUser({ id: TEST_IDS.user1 });
    mockPrisma.organization.findFirst.mockResolvedValue({
      id: TEST_IDS.org1,
      name: "test-org",
      ownerUserId: TEST_IDS.user1,
    });
    mockPrisma.organization.delete.mockResolvedValue({});

    const [req, ctx] = makeRequest(TEST_IDS.org1);
    const res = await DELETE(req, ctx);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(mockPrisma.organization.delete).toHaveBeenCalledWith({
      where: { id: TEST_IDS.org1 },
    });
  });

  it("enforces ownership check", async () => {
    setAuthenticatedUser({ id: TEST_IDS.user1 });
    mockPrisma.organization.findFirst.mockResolvedValue(null);

    const [req, ctx] = makeRequest(TEST_IDS.org2);
    const res = await DELETE(req, ctx);
    expect(res.status).toBe(404);
    expect(mockPrisma.organization.findFirst).toHaveBeenCalledWith({
      where: { id: TEST_IDS.org2, ownerUserId: TEST_IDS.user1 },
    });
  });
});
