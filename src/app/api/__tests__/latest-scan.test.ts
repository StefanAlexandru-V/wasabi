import { describe, it, expect, beforeEach } from "vitest";
import {
  mockPrisma,
  setAuthenticatedUser,
  resetMocks,
  TEST_IDS,
} from "@/__tests__/helpers/mocks";
import { GET } from "@/app/api/orgs/[orgId]/latest-scan/route";
import { NextRequest } from "next/server";

function makeRequest(orgId: string) {
  return [
    new NextRequest(`http://localhost:3000/api/orgs/${orgId}/latest-scan`),
    { params: Promise.resolve({ orgId }) },
  ] as const;
}

describe("GET /api/orgs/:orgId/latest-scan", () => {
  beforeEach(() => {
    resetMocks();
  });

  it("returns 401 when unauthenticated", async () => {
    const [req, ctx] = makeRequest(TEST_IDS.org1);
    const res = await GET(req, ctx);
    expect(res.status).toBe(401);
  });

  it("returns null scan and empty results when no scan exists", async () => {
    setAuthenticatedUser({ id: TEST_IDS.user1 });
    mockPrisma.scan.findFirst.mockResolvedValue(null);

    const [req, ctx] = makeRequest(TEST_IDS.org1);
    const res = await GET(req, ctx);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.scan).toBeNull();
    expect(body.results).toEqual([]);
  });

  it("returns latest completed scan with results", async () => {
    setAuthenticatedUser({ id: TEST_IDS.user1 });
    mockPrisma.scan.findFirst.mockResolvedValue({
      id: TEST_IDS.scan1,
      status: "completed",
      startedAt: new Date("2025-01-01"),
      completedAt: new Date("2025-01-01T00:05:00"),
      repoCount: 1,
      scores: [
        {
          scoreTotal: 5,
          severity: "low",
          scoreBreakdown: { inactivity: 3, criticalVulnerabilities: 0, missingCodeowners: 2, noBranchProtection: 0, stalePRs: 0, noCI: 0, notArchivedButInactive: 0 },
          repo: {
            name: "some-repo",
            pushedAt: new Date("2024-10-01"),
            archived: false,
          },
        },
      ],
    });

    const [req, ctx] = makeRequest(TEST_IDS.org1);
    const res = await GET(req, ctx);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.scan.id).toBe(TEST_IDS.scan1);
    expect(body.results).toHaveLength(1);
    expect(body.results[0].rank).toBe(1);
    expect(body.results[0].repoName).toBe("some-repo");
  });
});
