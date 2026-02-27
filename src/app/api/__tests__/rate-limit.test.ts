import { describe, it, expect, beforeEach } from "vitest";
import {
  mockPrisma,
  mockGithub,
  setAuthenticatedUser,
  resetMocks,
  TEST_IDS,
} from "@/__tests__/helpers/mocks";
import { GET } from "@/app/api/github/rate-limit/route";

describe("GET /api/github/rate-limit", () => {
  beforeEach(() => {
    resetMocks();
  });

  it("returns 401 when unauthenticated", async () => {
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("returns 400 when no GitHub token found", async () => {
    setAuthenticatedUser({ id: TEST_IDS.user1 });
    mockPrisma.account.findFirst.mockResolvedValue(null);

    const res = await GET();
    expect(res.status).toBe(400);
  });

  it("returns rate limit info", async () => {
    setAuthenticatedUser({ id: TEST_IDS.user1 });
    mockPrisma.account.findFirst.mockResolvedValue({
      access_token: "ghp_token",
    });
    mockGithub.fetchRateLimit.mockResolvedValue({
      remaining: 4500,
      limit: 5000,
      reset: Math.floor(Date.now() / 1000) + 3600,
    });

    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.remaining).toBe(4500);
    expect(body.limit).toBe(5000);
    expect(body.resetsAt).toBeDefined();
  });
});
