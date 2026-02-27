import { describe, it, expect, beforeEach } from "vitest";
import {
  mockPrisma,
  setAuthenticatedUser,
  resetMocks,
  TEST_IDS,
} from "@/__tests__/helpers/mocks";
import { GET } from "@/app/api/scan/[id]/results/route";
import { NextRequest } from "next/server";

function makeRequest(id: string) {
  return [
    new NextRequest(`http://localhost:3000/api/scan/${id}/results`),
    { params: Promise.resolve({ id }) },
  ] as const;
}

describe("GET /api/scan/:id/results", () => {
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

  it("returns ranked results ordered by score desc", async () => {
    setAuthenticatedUser({ id: TEST_IDS.user1 });
    mockPrisma.scan.findFirst.mockResolvedValue({
      id: TEST_IDS.scan1,
      status: "completed",
      startedAt: new Date("2025-01-01"),
      completedAt: new Date("2025-01-01T00:05:00"),
      repoCount: 2,
      scores: [
        {
          scoreTotal: 10,
          scoreBreakdown: { inactivity: 3, criticalVulnerabilities: 4, missingCodeowners: 0, noBranchProtection: 0, stalePRs: 0, noCI: 0, notArchivedButInactive: 3 },
          severity: "severe",
          repo: {
            name: "repo-a",
            pushedAt: new Date("2024-01-01"),
            archived: false,
          },
        },
        {
          scoreTotal: 3,
          scoreBreakdown: { inactivity: 3, criticalVulnerabilities: 0, missingCodeowners: 0, noBranchProtection: 0, stalePRs: 0, noCI: 0, notArchivedButInactive: 0 },
          severity: "low",
          repo: {
            name: "repo-b",
            pushedAt: new Date("2024-06-01"),
            archived: true,
          },
        },
      ],
    });

    const [req, ctx] = makeRequest(TEST_IDS.scan1);
    const res = await GET(req, ctx);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.scan.id).toBe(TEST_IDS.scan1);
    expect(body.scan.status).toBe("completed");
    expect(body.results).toHaveLength(2);
    expect(body.results[0].rank).toBe(1);
    expect(body.results[0].repoName).toBe("repo-a");
    expect(body.results[0].rotScore).toBe(10);
    expect(body.results[0].severity).toBe("severe");
    expect(body.results[1].rank).toBe(2);
    expect(body.results[1].repoName).toBe("repo-b");
  });
});
