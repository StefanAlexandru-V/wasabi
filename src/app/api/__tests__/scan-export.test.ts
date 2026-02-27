import { describe, it, expect, beforeEach } from "vitest";
import {
  mockPrisma,
  setAuthenticatedUser,
  setUserPlan,
  resetMocks,
  TEST_IDS,
} from "@/__tests__/helpers/mocks";
import { GET } from "@/app/api/scan/[id]/export/route";
import { NextRequest } from "next/server";

function makeRequest(id: string) {
  return [
    new NextRequest(`http://localhost:3000/api/scan/${id}/export`),
    { params: Promise.resolve({ id }) },
  ] as const;
}

describe("GET /api/scan/:id/export", () => {
  beforeEach(() => {
    resetMocks();
  });

  it("returns 401 when unauthenticated", async () => {
    const [req, ctx] = makeRequest(TEST_IDS.scan1);
    const res = await GET(req, ctx);
    expect(res.status).toBe(401);
  });

  it("returns 403 when user is on free plan", async () => {
    setAuthenticatedUser({ id: TEST_IDS.user1 });
    setUserPlan("free");

    const [req, ctx] = makeRequest(TEST_IDS.scan1);
    const res = await GET(req, ctx);
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toContain("Pro plan");
  });

  it("returns 404 when scan not found", async () => {
    setAuthenticatedUser({ id: TEST_IDS.user1 });
    setUserPlan("pro");
    mockPrisma.scan.findFirst.mockResolvedValue(null);

    const [req, ctx] = makeRequest(TEST_IDS.scan1);
    const res = await GET(req, ctx);
    expect(res.status).toBe(404);
  });

  it("returns valid CSV for pro plan", async () => {
    setAuthenticatedUser({ id: TEST_IDS.user1 });
    setUserPlan("pro");
    mockPrisma.scan.findFirst.mockResolvedValue({
      id: TEST_IDS.scan1,
      scores: [
        {
          scoreTotal: 8,
          severity: "high",
          repo: {
            name: "my-repo",
            pushedAt: new Date("2024-03-15T00:00:00Z"),
            archived: false,
          },
        },
        {
          scoreTotal: 2,
          severity: "low",
          repo: {
            name: "good-repo",
            pushedAt: null,
            archived: true,
          },
        },
      ],
    });

    const [req, ctx] = makeRequest(TEST_IDS.scan1);
    const res = await GET(req, ctx);
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("text/csv");
    expect(res.headers.get("Content-Disposition")).toContain(`scan-${TEST_IDS.scan1}.csv`);

    const csv = await res.text();
    const lines = csv.split("\n");
    expect(lines[0]).toBe("Rank,Repo Name,Rot Score,Severity,Last Commit,Archived");
    expect(lines[1]).toBe("1,my-repo,8,high,2024-03-15T00:00:00.000Z,No");
    expect(lines[2]).toBe("2,good-repo,2,low,N/A,Yes");
  });

  it("escapes CSV fields containing commas and quotes", async () => {
    setAuthenticatedUser({ id: TEST_IDS.user1 });
    setUserPlan("pro");
    mockPrisma.scan.findFirst.mockResolvedValue({
      id: TEST_IDS.scan2,
      scores: [
        {
          scoreTotal: 5,
          severity: "low",
          repo: {
            name: 'repo,with"special',
            pushedAt: new Date("2024-01-01T00:00:00Z"),
            archived: false,
          },
        },
      ],
    });

    const [req, ctx] = makeRequest(TEST_IDS.scan2);
    const res = await GET(req, ctx);
    const csv = await res.text();
    const lines = csv.split("\n");
    expect(lines[1]).toBe('1,"repo,with""special",5,low,2024-01-01T00:00:00.000Z,No');
  });
});
