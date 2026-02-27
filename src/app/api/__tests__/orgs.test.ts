import { describe, it, expect, beforeEach } from "vitest";
import {
  mockPrisma,
  mockGithub,
  setAuthenticatedUser,
  resetMocks,
  TEST_IDS,
} from "@/__tests__/helpers/mocks";
import { GET } from "@/app/api/orgs/route";

describe("GET /api/orgs", () => {
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

  it("returns available and connected orgs", async () => {
    setAuthenticatedUser({ id: TEST_IDS.user1 });
    mockPrisma.account.findFirst.mockResolvedValue({
      access_token: "ghp_token",
    });
    mockGithub.fetchUserOrgs.mockResolvedValue([
      { id: "100", login: "org-a", avatar_url: "https://example.com/a.png" },
      { id: "200", login: "org-b", avatar_url: "https://example.com/b.png" },
    ]);
    mockPrisma.organization.findMany.mockResolvedValue([
      { id: TEST_IDS.org1, githubOrgId: "100", name: "org-a", ownerUserId: TEST_IDS.user1 },
    ]);

    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.available).toHaveLength(2);
    expect(body.available[0].connected).toBe(true);
    expect(body.available[1].connected).toBe(false);
    expect(body.connected).toHaveLength(1);
    expect(body.connected[0].name).toBe("org-a");
  });
});
