import { describe, it, expect, beforeEach } from "vitest";
import {
  mockPrisma,
  mockGithub,
  setAuthenticatedUser,
  setUserPlan,
  resetMocks,
  TEST_IDS,
} from "@/__tests__/helpers/mocks";
import { POST } from "@/app/api/orgs/connect/route";
import { NextRequest } from "next/server";

function makeRequest(body: Record<string, unknown>) {
  return new NextRequest("http://localhost:3000/api/orgs/connect", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/orgs/connect", () => {
  beforeEach(() => {
    resetMocks();
  });

  it("returns 401 when unauthenticated", async () => {
    const res = await POST(makeRequest({ name: "test-org" }));
    expect(res.status).toBe(401);
  });

  it("returns 400 when name is missing", async () => {
    setAuthenticatedUser({ id: TEST_IDS.user1 });
    const res = await POST(makeRequest({}));
    expect(res.status).toBe(400);
  });

  it("resolves githubOrgId via Octokit when not provided", async () => {
    setAuthenticatedUser({ id: TEST_IDS.user1 });
    setUserPlan("pro");
    mockPrisma.account.findFirst.mockResolvedValue({
      access_token: "ghp_token",
    });
    mockGithub.createRestClient.mockReturnValue({
      orgs: {
        get: async () => ({ data: { id: 12345 } }),
      },
    });
    mockPrisma.organization.upsert.mockResolvedValue({
      id: TEST_IDS.org1,
      githubOrgId: "12345",
      name: "test-org",
      ownerUserId: TEST_IDS.user1,
    });

    const res = await POST(makeRequest({ name: "test-org" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.name).toBe("test-org");
    expect(mockPrisma.organization.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          githubOrgId_ownerUserId: {
            githubOrgId: "12345",
            ownerUserId: TEST_IDS.user1,
          },
        },
      })
    );
  });

  it("returns 404 when GitHub org not found", async () => {
    setAuthenticatedUser({ id: TEST_IDS.user1 });
    mockPrisma.account.findFirst.mockResolvedValue({
      access_token: "ghp_token",
    });
    mockGithub.createRestClient.mockReturnValue({
      orgs: {
        get: async () => {
          throw new Error("Not Found");
        },
      },
    });

    const res = await POST(makeRequest({ name: "nonexistent-org" }));
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toContain("nonexistent-org");
  });

  it("returns 403 when free plan already has 1 org", async () => {
    setAuthenticatedUser({ id: TEST_IDS.user1 });
    setUserPlan("free");
    mockPrisma.account.findFirst.mockResolvedValue({
      access_token: "ghp_token",
    });
    mockGithub.createRestClient.mockReturnValue({
      orgs: {
        get: async () => ({ data: { id: 99 } }),
      },
    });
    mockPrisma.organization.count.mockResolvedValue(1);

    const res = await POST(makeRequest({ name: "second-org" }));
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toContain("Free plan");
  });

  it("succeeds with githubOrgId provided directly", async () => {
    setAuthenticatedUser({ id: TEST_IDS.user1 });
    setUserPlan("pro");
    mockPrisma.organization.upsert.mockResolvedValue({
      id: TEST_IDS.org2,
      githubOrgId: "555",
      name: "direct-org",
      ownerUserId: TEST_IDS.user1,
    });

    const res = await POST(
      makeRequest({ name: "direct-org", githubOrgId: "555" })
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.githubOrgId).toBe("555");
  });
});
