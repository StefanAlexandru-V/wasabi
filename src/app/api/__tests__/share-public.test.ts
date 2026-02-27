import { describe, it, expect, beforeEach } from "vitest";
import {
  mockPrisma,
  resetMocks,
} from "@/__tests__/helpers/mocks";
import { GET } from "@/app/api/share/[token]/route";
import { NextRequest } from "next/server";

function makeRequest(token: string) {
  return [
    new NextRequest(`http://localhost:3000/api/share/${token}`),
    { params: Promise.resolve({ token }) },
  ] as const;
}

describe("GET /api/share/:token", () => {
  beforeEach(() => {
    resetMocks();
  });

  it("returns 400 for invalid token", async () => {
    const [req, ctx] = makeRequest("short");
    const res = await GET(req, ctx);
    expect(res.status).toBe(400);
  });

  it("returns 404 when token not found", async () => {
    mockPrisma.scan.findUnique.mockResolvedValue(null);

    const [req, ctx] = makeRequest("abcdef1234567890abcdef1234567890");
    const res = await GET(req, ctx);
    expect(res.status).toBe(404);
  });

  it("returns report data for valid token (no auth required)", async () => {
    mockPrisma.scan.findUnique.mockResolvedValue({
      id: "scan-123",
      status: "completed",
      startedAt: new Date("2025-01-01"),
      completedAt: new Date("2025-01-01T00:05:00"),
      repoCount: 2,
      shareToken: "valid-token-1234567890abcdef",
      org: { name: "my-org" },
      scores: [
        {
          scoreTotal: 10,
          severity: "severe",
          scoreBreakdown: { inactivity: 3, criticalVulnerabilities: 4, notArchivedButInactive: 3 },
          repo: { name: "repo-a", archived: false, pushedAt: new Date("2024-01-01") },
        },
        {
          scoreTotal: 3,
          severity: "low",
          scoreBreakdown: { inactivity: 3 },
          repo: { name: "repo-b", archived: true, pushedAt: new Date("2024-06-01") },
        },
      ],
    });

    const [req, ctx] = makeRequest("valid-token-1234567890abcdef");
    const res = await GET(req, ctx);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.orgName).toBe("my-org");
    expect(body.scan.id).toBe("scan-123");
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
