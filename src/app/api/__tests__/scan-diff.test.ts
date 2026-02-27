import { describe, it, expect, beforeEach } from "vitest";
import {
  mockPrisma,
  setAuthenticatedUser,
  resetMocks,
  TEST_IDS,
} from "@/__tests__/helpers/mocks";
import { GET } from "@/app/api/scan/diff/route";
import { NextRequest } from "next/server";

function makeRequest(scanA?: string, scanB?: string) {
  const params = new URLSearchParams();
  if (scanA) params.set("scanA", scanA);
  if (scanB) params.set("scanB", scanB);
  return new NextRequest(`http://localhost:3000/api/scan/diff?${params}`);
}

const makeScan = (id: string, scores: { name: string; score: number; severity: string }[]) => ({
  id,
  startedAt: new Date("2025-01-01"),
  completedAt: new Date("2025-01-01T00:05:00"),
  repoCount: scores.length,
  scores: scores.map((s) => ({
    scoreTotal: s.score,
    severity: s.severity,
    scoreBreakdown: { inactivity: s.score },
    repo: { name: s.name },
  })),
});

describe("GET /api/scan/diff", () => {
  beforeEach(() => {
    resetMocks();
  });

  it("returns 401 when unauthenticated", async () => {
    const req = makeRequest(TEST_IDS.scan1, TEST_IDS.scan2);
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it("returns 400 when params are missing", async () => {
    setAuthenticatedUser({ id: TEST_IDS.user1 });
    const res = await GET(makeRequest());
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("scanA and scanB");
  });

  it("returns 400 for invalid UUID format", async () => {
    setAuthenticatedUser({ id: TEST_IDS.user1 });
    const res = await GET(makeRequest("not-uuid", TEST_IDS.scan2));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("Invalid scan ID");
  });

  it("returns 404 when one scan is not found", async () => {
    setAuthenticatedUser({ id: TEST_IDS.user1 });
    mockPrisma.scan.findFirst
      .mockResolvedValueOnce(makeScan(TEST_IDS.scan1, []))
      .mockResolvedValueOnce(null);

    const res = await GET(makeRequest(TEST_IDS.scan1, TEST_IDS.scan2));
    expect(res.status).toBe(404);
  });

  it("returns diff with improved, worsened, unchanged repos", async () => {
    setAuthenticatedUser({ id: TEST_IDS.user1 });

    const scanA = makeScan(TEST_IDS.scan1, [
      { name: "repo-a", score: 10, severity: "severe" },
      { name: "repo-b", score: 5, severity: "low" },
      { name: "repo-c", score: 7, severity: "high" },
    ]);
    const scanB = makeScan(TEST_IDS.scan2, [
      { name: "repo-a", score: 6, severity: "low" },
      { name: "repo-b", score: 5, severity: "low" },
      { name: "repo-d", score: 3, severity: "low" },
    ]);

    mockPrisma.scan.findFirst
      .mockResolvedValueOnce(scanA)
      .mockResolvedValueOnce(scanB);

    const res = await GET(makeRequest(TEST_IDS.scan1, TEST_IDS.scan2));
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.summary.improved).toBe(1);
    expect(body.summary.worsened).toBe(0);
    expect(body.summary.unchanged).toBe(1);
    expect(body.summary.added).toBe(1);
    expect(body.summary.removed).toBe(1);

    expect(body.diff).toHaveLength(4);

    const repoA = body.diff.find((d: { repoName: string }) => d.repoName === "repo-a");
    expect(repoA.delta).toBe(-4);
    expect(repoA.status).toBe("improved");

    const repoD = body.diff.find((d: { repoName: string }) => d.repoName === "repo-d");
    expect(repoD.status).toBe("added");
    expect(repoD.scoreA).toBeNull();

    const repoC = body.diff.find((d: { repoName: string }) => d.repoName === "repo-c");
    expect(repoC.status).toBe("removed");
    expect(repoC.scoreB).toBeNull();
  });
});
