import { vi } from "vitest";

export const TEST_IDS = {
  user1: "00000000-0000-0000-0000-000000000001",
  user2: "00000000-0000-0000-0000-000000000002",
  org1: "00000000-0000-0000-0000-000000000010",
  org2: "00000000-0000-0000-0000-000000000020",
  scan1: "00000000-0000-0000-0000-000000000100",
  scan2: "00000000-0000-0000-0000-000000000200",
};

export const mockPrisma = {
  organization: {
    findFirst: vi.fn(),
    findMany: vi.fn(),
    count: vi.fn(),
    upsert: vi.fn(),
    delete: vi.fn(),
  },
  scan: {
    create: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
    count: vi.fn(),
  },
  subscription: {
    findUnique: vi.fn(),
  },
  account: {
    findFirst: vi.fn(),
  },
  repository: {
    upsert: vi.fn(),
  },
  repoScore: {
    upsert: vi.fn(),
    findMany: vi.fn(),
  },
};

vi.mock("@/lib/prisma", () => ({
  prisma: mockPrisma,
}));

export const mockAuth = vi.fn();

vi.mock("@/lib/auth", () => ({
  auth: () => mockAuth(),
}));

export const mockInngest = {
  send: vi.fn(),
};

vi.mock("@/inngest/client", () => ({
  inngest: mockInngest,
}));

export const mockGithub = {
  fetchUserOrgs: vi.fn(),
  createRestClient: vi.fn(),
  fetchOrgRepos: vi.fn(),
  checkBranchProtection: vi.fn(),
  checkFileExists: vi.fn(),
  countStalePRs: vi.fn(),
  fetchRateLimit: vi.fn(),
  getLastRateLimit: vi.fn(),
};

vi.mock("@/lib/github", () => mockGithub);

vi.mock("@/lib/encryption", () => ({
  encrypt: vi.fn((v: string) => v),
  decrypt: vi.fn((v: string) => v),
  isEncrypted: vi.fn(() => false),
}));

export function setAuthenticatedUser(user: { id: string; name?: string; email?: string } | null) {
  if (user) {
    mockAuth.mockResolvedValue({ user });
  } else {
    mockAuth.mockResolvedValue(null);
  }
}

export function setUserPlan(plan: "free" | "pro") {
  if (plan === "pro") {
    mockPrisma.subscription.findUnique.mockResolvedValue({
      plan: "pro",
      status: "active",
    });
  } else {
    mockPrisma.subscription.findUnique.mockResolvedValue(null);
  }
}

export function resetMocks() {
  vi.clearAllMocks();
  mockAuth.mockResolvedValue(null);
}
