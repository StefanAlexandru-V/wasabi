import { describe, it, expect, beforeEach } from "vitest";
import {
  mockPrisma,
  setAuthenticatedUser,
  resetMocks,
  TEST_IDS,
} from "@/__tests__/helpers/mocks";
import { GET } from "@/app/api/orgs/[orgId]/scans/route";
import { NextRequest } from "next/server";

function makeRequest(orgId: string) {
  return [
    new NextRequest(`http://localhost:3000/api/orgs/${orgId}/scans`),
    { params: Promise.resolve({ orgId }) },
  ] as const;
}

describe("GET /api/orgs/:orgId/scans", () => {
  beforeEach(() => {
    resetMocks();
  });

  it("returns 401 when unauthenticated", async () => {
    const [req, ctx] = makeRequest(TEST_IDS.org1);
    const res = await GET(req, ctx);
    expect(res.status).toBe(401);
  });

  it("returns 400 for invalid orgId", async () => {
    setAuthenticatedUser({ id: TEST_IDS.user1 });
    const [req, ctx] = makeRequest("not-a-uuid");
    const res = await GET(req, ctx);
    expect(res.status).toBe(400);
  });

  it("returns empty array when no scans exist", async () => {
    setAuthenticatedUser({ id: TEST_IDS.user1 });
    mockPrisma.scan.findMany.mockResolvedValue([]);

    const [req, ctx] = makeRequest(TEST_IDS.org1);
    const res = await GET(req, ctx);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.scans).toEqual([]);
  });

  it("returns scan history ordered by startedAt desc", async () => {
    setAuthenticatedUser({ id: TEST_IDS.user1 });

    const scans = [
      {
        id: TEST_IDS.scan1,
        status: "completed",
        startedAt: new Date("2025-06-15T10:00:00Z"),
        completedAt: new Date("2025-06-15T10:05:00Z"),
        repoCount: 50,
        totalRepoCount: 50,
        processedRepoCount: 50,
      },
      {
        id: TEST_IDS.scan2,
        status: "failed",
        startedAt: new Date("2025-06-14T10:00:00Z"),
        completedAt: null,
        repoCount: 0,
        totalRepoCount: 30,
        processedRepoCount: 12,
      },
    ];
    mockPrisma.scan.findMany.mockResolvedValue(scans);

    const [req, ctx] = makeRequest(TEST_IDS.org1);
    const res = await GET(req, ctx);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.scans).toHaveLength(2);
    expect(body.scans[0].id).toBe(TEST_IDS.scan1);
    expect(body.scans[0].status).toBe("completed");
    expect(body.scans[1].id).toBe(TEST_IDS.scan2);
    expect(body.scans[1].status).toBe("failed");
  });

  it("filters by ownerUserId via the where clause", async () => {
    setAuthenticatedUser({ id: TEST_IDS.user1 });
    mockPrisma.scan.findMany.mockResolvedValue([]);

    const [req, ctx] = makeRequest(TEST_IDS.org1);
    await GET(req, ctx);

    expect(mockPrisma.scan.findMany).toHaveBeenCalledWith({
      where: { orgId: TEST_IDS.org1, org: { ownerUserId: TEST_IDS.user1 } },
      orderBy: { startedAt: "desc" },
      take: 20,
      select: {
        id: true,
        status: true,
        startedAt: true,
        completedAt: true,
        repoCount: true,
        totalRepoCount: true,
        processedRepoCount: true,
      },
    });
  });

  it("returns 500 on unexpected error", async () => {
    setAuthenticatedUser({ id: TEST_IDS.user1 });
    mockPrisma.scan.findMany.mockRejectedValue(new Error("DB connection lost"));

    const [req, ctx] = makeRequest(TEST_IDS.org1);
    const res = await GET(req, ctx);
    expect(res.status).toBe(500);
  });
});
