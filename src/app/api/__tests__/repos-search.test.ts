import { describe, it, expect, beforeEach } from "vitest";
import {
  mockPrisma,
  setAuthenticatedUser,
  resetMocks,
  TEST_IDS,
} from "@/__tests__/helpers/mocks";
import { GET } from "@/app/api/repos/search/route";
import { NextRequest } from "next/server";

function makeRequest(params: Record<string, string> = {}) {
  const sp = new URLSearchParams(params);
  return new NextRequest(`http://localhost:3000/api/repos/search?${sp}`);
}

describe("GET /api/repos/search", () => {
  beforeEach(() => {
    resetMocks();
  });

  it("returns 401 when unauthenticated", async () => {
    const res = await GET(makeRequest());
    expect(res.status).toBe(401);
  });

  it("returns empty results when user has no orgs", async () => {
    setAuthenticatedUser({ id: TEST_IDS.user1 });
    mockPrisma.organization.findMany.mockResolvedValue([]);

    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.results).toEqual([]);
  });

  it("returns empty results when no completed scans", async () => {
    setAuthenticatedUser({ id: TEST_IDS.user1 });
    mockPrisma.organization.findMany.mockResolvedValue([
      { id: TEST_IDS.org1, name: "my-org" },
    ]);
    mockPrisma.scan.findMany.mockResolvedValue([]);

    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.results).toEqual([]);
  });

  it("returns search results across orgs", async () => {
    setAuthenticatedUser({ id: TEST_IDS.user1 });
    mockPrisma.organization.findMany.mockResolvedValue([
      { id: TEST_IDS.org1, name: "org-one" },
      { id: TEST_IDS.org2, name: "org-two" },
    ]);
    mockPrisma.scan.findMany.mockResolvedValue([
      { id: TEST_IDS.scan1, orgId: TEST_IDS.org1 },
      { id: TEST_IDS.scan2, orgId: TEST_IDS.org2 },
    ]);
    mockPrisma.repoScore.findMany.mockResolvedValue([
      {
        scanId: TEST_IDS.scan1,
        scoreTotal: 10,
        severity: "severe",
        scoreBreakdown: { inactivity: 3 },
        repo: { name: "api-server", archived: false, pushedAt: new Date("2024-01-01") },
      },
      {
        scanId: TEST_IDS.scan2,
        scoreTotal: 5,
        severity: "low",
        scoreBreakdown: { noCI: 1 },
        repo: { name: "api-client", archived: true, pushedAt: null },
      },
    ]);

    const res = await GET(makeRequest({ q: "api" }));
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.results).toHaveLength(2);
    expect(body.results[0].repoName).toBe("api-server");
    expect(body.results[0].orgName).toBe("org-one");
    expect(body.results[1].repoName).toBe("api-client");
    expect(body.results[1].orgName).toBe("org-two");
  });

  it("filters by severity", async () => {
    setAuthenticatedUser({ id: TEST_IDS.user1 });
    mockPrisma.organization.findMany.mockResolvedValue([
      { id: TEST_IDS.org1, name: "my-org" },
    ]);
    mockPrisma.scan.findMany.mockResolvedValue([
      { id: TEST_IDS.scan1, orgId: TEST_IDS.org1 },
    ]);
    mockPrisma.repoScore.findMany.mockResolvedValue([
      {
        scanId: TEST_IDS.scan1,
        scoreTotal: 12,
        severity: "severe",
        scoreBreakdown: {},
        repo: { name: "bad-repo", archived: false, pushedAt: new Date("2024-01-01") },
      },
    ]);

    const res = await GET(makeRequest({ severity: "severe" }));
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.results).toHaveLength(1);
    expect(body.results[0].severity).toBe("severe");

    expect(mockPrisma.repoScore.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ severity: "severe" }),
      })
    );
  });

  it("filters by minScore", async () => {
    setAuthenticatedUser({ id: TEST_IDS.user1 });
    mockPrisma.organization.findMany.mockResolvedValue([
      { id: TEST_IDS.org1, name: "my-org" },
    ]);
    mockPrisma.scan.findMany.mockResolvedValue([
      { id: TEST_IDS.scan1, orgId: TEST_IDS.org1 },
    ]);
    mockPrisma.repoScore.findMany.mockResolvedValue([]);

    const res = await GET(makeRequest({ minScore: "7" }));
    expect(res.status).toBe(200);

    expect(mockPrisma.repoScore.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ scoreTotal: { gte: 7 } }),
      })
    );
  });
});
