import { describe, it, expect, beforeEach } from "vitest";
import {
  mockPrisma,
  setAuthenticatedUser,
  resetMocks,
  TEST_IDS,
} from "@/__tests__/helpers/mocks";
import { GET } from "@/app/api/orgs/[orgId]/stats/route";
import { NextRequest } from "next/server";

function makeRequest(orgId: string) {
  return [
    new NextRequest(`http://localhost:3000/api/orgs/${orgId}/stats`),
    { params: Promise.resolve({ orgId }) },
  ] as const;
}

describe("GET /api/orgs/:orgId/stats", () => {
  beforeEach(() => {
    resetMocks();
  });

  it("returns 401 when unauthenticated", async () => {
    const [req, ctx] = makeRequest(TEST_IDS.org1);
    const res = await GET(req, ctx);
    expect(res.status).toBe(401);
  });

  it("returns 400 for invalid org ID", async () => {
    setAuthenticatedUser({ id: TEST_IDS.user1 });
    const [req, ctx] = makeRequest("not-a-uuid");
    const res = await GET(req, ctx);
    expect(res.status).toBe(400);
  });

  it("returns 404 when org not found", async () => {
    setAuthenticatedUser({ id: TEST_IDS.user1 });
    mockPrisma.organization.findFirst.mockResolvedValue(null);

    const [req, ctx] = makeRequest(TEST_IDS.org1);
    const res = await GET(req, ctx);
    expect(res.status).toBe(404);
  });

  it("returns empty stats when no completed scan exists", async () => {
    setAuthenticatedUser({ id: TEST_IDS.user1 });
    mockPrisma.organization.findFirst.mockResolvedValue({ id: TEST_IDS.org1 });
    mockPrisma.scan.findFirst.mockResolvedValue(null);

    const [req, ctx] = makeRequest(TEST_IDS.org1);
    const res = await GET(req, ctx);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.totalRepos).toBe(0);
    expect(body.avgScore).toBe(0);
    expect(body.topRotFactors).toEqual([]);
    expect(body.scoreDistribution).toEqual([]);
  });

  it("returns correct stats for a completed scan", async () => {
    setAuthenticatedUser({ id: TEST_IDS.user1 });
    mockPrisma.organization.findFirst.mockResolvedValue({ id: TEST_IDS.org1 });
    mockPrisma.scan.findFirst.mockResolvedValue({
      id: TEST_IDS.scan1,
      scores: [
        {
          scoreTotal: 12,
          severity: "severe",
          scoreBreakdown: { inactivity: 3, criticalVulnerabilities: 4, noBranchProtection: 2, notArchivedButInactive: 3 },
        },
        {
          scoreTotal: 5,
          severity: "low",
          scoreBreakdown: { inactivity: 3, missingCodeowners: 2 },
        },
        {
          scoreTotal: 8,
          severity: "high",
          scoreBreakdown: { inactivity: 3, criticalVulnerabilities: 4, noCI: 1 },
        },
      ],
    });
    mockPrisma.scan.count.mockResolvedValue(3);

    const [req, ctx] = makeRequest(TEST_IDS.org1);
    const res = await GET(req, ctx);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.totalRepos).toBe(3);
    expect(body.avgScore).toBe(8);
    expect(body.severeCount).toBe(1);
    expect(body.highCount).toBe(1);
    expect(body.lowCount).toBe(1);
    expect(body.severePct).toBe(33);
    expect(body.totalScans).toBe(3);

    expect(body.topRotFactors[0].factor).toBe("inactivity");
    expect(body.topRotFactors[0].count).toBe(3);

    expect(body.scoreDistribution).toHaveLength(5);
    expect(body.scoreDistribution[0]).toEqual({ label: "0-3", count: 0 });
    expect(body.scoreDistribution[1]).toEqual({ label: "4-6", count: 1 });
    expect(body.scoreDistribution[2]).toEqual({ label: "7-9", count: 1 });
    expect(body.scoreDistribution[3]).toEqual({ label: "10-13", count: 1 });
  });
});
