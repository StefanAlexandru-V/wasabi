import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { render, screen, waitFor, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Dashboard } from "@/components/dashboard";
import { ToastProvider } from "@/components/toast";

vi.mock("next-auth/react", () => ({
  signOut: vi.fn(),
}));

vi.mock("next/image", () => ({
  default: (props: Record<string, unknown>) => {
    const { src, alt, width, height, ...rest } = props;
    return <img src={src as string} alt={alt as string} width={width as number} height={height as number} {...rest} />;
  },
}));

const mockUser = { id: "user-1", name: "Test User", image: "https://example.com/avatar.png" };

const mockOrgs = [
  { id: "org-1", name: "test-org", githubOrgId: "100" },
  { id: "org-2", name: "another-org", githubOrgId: "200" },
];

function setupFetchMock(responses: Record<string, unknown>) {
  const defaults: Record<string, unknown> = {
    "/api/github/rate-limit": { remaining: 5000, limit: 5000, resetsAt: new Date().toISOString() },
    "/orgs/org-1/stats": { totalRepos: 0, avgScore: 0, severeCount: 0, highCount: 0, lowCount: 0, severePct: 0, topRotFactors: [], scoreDistribution: [], totalScans: 0 },
    "/orgs/org-2/stats": { totalRepos: 0, avgScore: 0, severeCount: 0, highCount: 0, lowCount: 0, severePct: 0, topRotFactors: [], scoreDistribution: [], totalScans: 0 },
    "/scans": { scans: [] },
  };
  const merged = { ...defaults, ...responses };
  const sortedEntries = Object.entries(merged).sort(
    ([a], [b]) => b.length - a.length
  );
  global.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input.toString();
    if (init?.signal?.aborted) {
      throw new DOMException("The operation was aborted.", "AbortError");
    }
    for (const [pattern, data] of sortedEntries) {
      if (url.includes(pattern)) {
        return {
          ok: true,
          json: async () => data,
          text: async () => JSON.stringify(data),
        } as Response;
      }
    }
    return {
      ok: true,
      json: async () => ({}),
      text: async () => "{}",
    } as Response;
  }) as unknown as typeof fetch;
}

function renderDashboard(props?: { orgs?: typeof mockOrgs; plan?: string }) {
  return render(
    <ToastProvider>
      <Dashboard
        user={mockUser}
        orgs={props?.orgs ?? mockOrgs}
        plan={props?.plan ?? "free"}
      />
    </ToastProvider>
  );
}

describe("Dashboard", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    Object.defineProperty(window, "location", {
      value: { search: "", href: "" },
      writable: true,
      configurable: true,
    });
    window.history.replaceState = vi.fn();
    Object.defineProperty(window, "Notification", {
      value: { permission: "denied", requestPermission: vi.fn().mockResolvedValue("denied") },
      writable: true,
      configurable: true,
    });
    class MockEventSource {
      onmessage: ((event: MessageEvent) => void) | null = null;
      onerror: (() => void) | null = null;
      readyState = 0;
      close = vi.fn();
    }
    (globalThis as unknown as Record<string, unknown>).EventSource = MockEventSource;
  });

  afterEach(() => {
    cleanup();
  });

  it("renders user name and plan", () => {
    setupFetchMock({
      "/api/orgs": { available: [], connected: [] },
      "/latest-scan": { scan: null, results: [] },
    });
    renderDashboard();
    expect(screen.getByText(/Test User/)).toBeInTheDocument();
    expect(screen.getByText(/free/)).toBeInTheDocument();
  });

  it("renders upgrade button for free plan", () => {
    setupFetchMock({
      "/api/orgs": { available: [], connected: [] },
      "/latest-scan": { scan: null, results: [] },
    });
    renderDashboard();
    expect(screen.getByText("Upgrade to Pro")).toBeInTheDocument();
  });

  it("does not render upgrade button for pro plan", () => {
    setupFetchMock({
      "/api/orgs": { available: [], connected: [] },
      "/latest-scan": { scan: null, results: [] },
    });
    renderDashboard({ plan: "pro" });
    expect(screen.queryByText("Upgrade to Pro")).not.toBeInTheDocument();
  });

  it("renders org selector with options", () => {
    setupFetchMock({
      "/api/orgs": { available: [], connected: [] },
      "/latest-scan": { scan: null, results: [] },
    });
    renderDashboard();
    expect(screen.getByText("test-org")).toBeInTheDocument();
    expect(screen.getByText("another-org")).toBeInTheDocument();
  });

  it("renders scan button in quality gate when org selected", async () => {
    setupFetchMock({
      "/api/orgs": { available: [], connected: [] },
      "/latest-scan": { scan: null, results: [] },
    });
    renderDashboard();
    // When org is selected but no scan yet, shows "Start Scan" in quality gate
    await waitFor(() => {
      expect(screen.getByText("Start Scan")).toBeInTheDocument();
    });
  });

  it("shows add org panel when no orgs exist", () => {
    setupFetchMock({
      "/api/orgs": { available: [], connected: [] },
    });
    renderDashboard({ orgs: [] });
    expect(screen.getByText("Connect an Organization")).toBeInTheDocument();
  });

  it("toggles add org panel", async () => {
    const user = userEvent.setup();
    setupFetchMock({
      "/api/orgs": { available: [], connected: [] },
      "/latest-scan": { scan: null, results: [] },
    });
    renderDashboard();
    expect(screen.queryByText("Connect an Organization")).not.toBeInTheDocument();
    await user.click(screen.getByLabelText("Add organization"));
    expect(screen.getByText("Connect an Organization")).toBeInTheDocument();
  });

  it("renders empty state message in results table", async () => {
    const user = userEvent.setup();
    setupFetchMock({
      "/api/orgs": { available: [], connected: [] },
      "/latest-scan": { scan: null, results: [] },
    });
    renderDashboard();
    // Wait for tabs to render, then navigate to Repositories tab
    await waitFor(() => {
      expect(screen.getByText("Repositories")).toBeInTheDocument();
    });
    await user.click(screen.getByText("Repositories"));
    await waitFor(() => {
      expect(screen.getByText(/No scan results yet/)).toBeInTheDocument();
    });
  });

  it("shows export CSV button only for pro plan with results", async () => {
    const user = userEvent.setup();
    const scanResults = [
      {
        rank: 1,
        repoName: "test-repo",
        rotScore: 5,
        severity: "low",
        lastCommit: "2024-01-01",
        scoreBreakdown: { inactivity: 3, criticalVulnerabilities: 0, missingCodeowners: 2, noBranchProtection: 0, stalePRs: 0, noCI: 0, notArchivedButInactive: 0 },
        archived: false,
      },
    ];
    setupFetchMock({
      "/api/orgs": { available: [], connected: [] },
      "/latest-scan": {
        scan: { id: "scan-1", status: "completed" },
        results: scanResults,
      },
    });
    renderDashboard({ plan: "pro" });

    // Wait for results to load, then open actions menu
    await waitFor(() => {
      expect(screen.getByLabelText("Actions menu")).toBeInTheDocument();
    });
    await user.click(screen.getByLabelText("Actions menu"));
    expect(screen.getByText("Export CSV")).toBeInTheDocument();
  });

  it("displays scan progress when scan is active", async () => {
    setupFetchMock({
      "/api/orgs": { available: [], connected: [] },
      "/latest-scan": {
        scan: { id: "scan-1", status: "running" },
        results: [],
      },
      "/status": {
        status: "running",
        startedAt: new Date().toISOString(),
        totalRepoCount: 10,
        processedRepoCount: 3,
      },
    });
    renderDashboard();

    await waitFor(() => {
      expect(screen.getByText("Scanning repositories...")).toBeInTheDocument();
    });
  });

  it("renders available orgs in add org panel", async () => {
    const user = userEvent.setup();
    setupFetchMock({
      "/api/orgs": {
        available: [
          { id: "300", login: "cool-org", avatar_url: "", connected: false },
          { id: "400", login: "other-org", avatar_url: "", connected: false },
        ],
        connected: [],
      },
      "/latest-scan": { scan: null, results: [] },
    });
    renderDashboard();
    await user.click(screen.getByLabelText("Add organization"));

    await waitFor(() => {
      expect(screen.getByText("cool-org")).toBeInTheDocument();
      expect(screen.getByText("other-org")).toBeInTheDocument();
    });
  });

  it("renders sign out button", () => {
    setupFetchMock({
      "/api/orgs": { available: [], connected: [] },
      "/latest-scan": { scan: null, results: [] },
    });
    renderDashboard();
    expect(screen.getByText("Sign out")).toBeInTheDocument();
  });

  it("renders header title", () => {
    setupFetchMock({
      "/api/orgs": { available: [], connected: [] },
      "/latest-scan": { scan: null, results: [] },
    });
    renderDashboard();
    expect(screen.getByText("Wasabi")).toBeInTheDocument();
  });

  it("shows ready to scan state when no org selected", () => {
    setupFetchMock({
      "/api/orgs": { available: [], connected: [] },
    });
    renderDashboard({ orgs: [] });
    // Quality gate shows "Ready to scan" state - no scan button without org selected
    expect(screen.getByText("Ready to scan")).toBeInTheDocument();
    expect(screen.getByText("Run your first scan to check organization health")).toBeInTheDocument();
  });

  it("opens delete confirmation modal", async () => {
    const user = userEvent.setup();
    setupFetchMock({
      "/api/orgs": { available: [], connected: [] },
      "/latest-scan": { scan: null, results: [] },
    });
    renderDashboard();
    // Open actions menu first, then click delete
    await user.click(screen.getByLabelText("Actions menu"));
    await user.click(screen.getByText(/Delete test-org/));
    expect(screen.getByText(/Delete "test-org"/)).toBeInTheDocument();
    expect(screen.getByText("Delete Organization")).toBeInTheDocument();
    expect(screen.getByText("Cancel")).toBeInTheDocument();
  });

  it("cancels delete via modal", async () => {
    const user = userEvent.setup();
    setupFetchMock({
      "/api/orgs": { available: [], connected: [] },
      "/latest-scan": { scan: null, results: [] },
    });
    renderDashboard();
    // Open actions menu first, then click delete
    await user.click(screen.getByLabelText("Actions menu"));
    await user.click(screen.getByText(/Delete test-org/));
    await user.click(screen.getByText("Cancel"));
    expect(screen.queryByText(/Delete "test-org"/)).not.toBeInTheDocument();
  });
});
