import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { OverviewTab } from "../overview-tab";
import { QualityGateBadge, QualityGateCard } from "../quality-gate";
import { computeQualityGate } from "../types";
import type { ScanResult, OrgStats } from "../types";

const mockRelativeTime = vi.fn((date: string) => `relative(${date})`);

const createMockResult = (overrides: Partial<ScanResult> = {}): ScanResult => ({
  rank: 1,
  repoName: "test-repo",
  rotScore: 5,
  severity: "low",
  lastCommit: "2024-01-01T00:00:00Z",
  scoreBreakdown: { noBranchProtection: 2, stalePRs: 2, noCI: 1 },
  archived: false,
  ...overrides,
});

const createMockOrgStats = (overrides: Partial<OrgStats> = {}): OrgStats => ({
  totalRepos: 10,
  avgScore: 5,
  severeCount: 1,
  highCount: 3,
  lowCount: 6,
  severePct: 10,
  topRotFactors: [
    { factor: "noBranchProtection", count: 8, pct: 80 },
    { factor: "stalePRs", count: 5, pct: 50 },
  ],
  scoreDistribution: [
    { label: "0-3", count: 2 },
    { label: "4-6", count: 5 },
    { label: "7-9", count: 2 },
    { label: "10+", count: 1 },
  ],
  totalScans: 5,
  ...overrides,
});

describe("computeQualityGate", () => {
  it("returns unknown for empty results", () => {
    const result = computeQualityGate([]);
    expect(result.status).toBe("unknown");
    expect(result.reason).toBe("No scan data");
  });

  it("returns fail when severe repos exist", () => {
    const results = [
      createMockResult({ severity: "severe", rotScore: 12 }),
      createMockResult({ severity: "low", rotScore: 3 }),
    ];
    const result = computeQualityGate(results);
    expect(result.status).toBe("fail");
    expect(result.reason).toContain("severe");
  });

  it("returns fail when high-risk repos exceed 20%", () => {
    const results = [
      createMockResult({ severity: "high", rotScore: 8 }),
      createMockResult({ severity: "high", rotScore: 9 }),
      createMockResult({ severity: "low", rotScore: 3 }),
      createMockResult({ severity: "low", rotScore: 2 }),
    ];
    const result = computeQualityGate(results);
    expect(result.status).toBe("fail");
    expect(result.reason).toContain("high-risk");
  });

  it("returns fail when average score exceeds 6", () => {
    const results = [
      createMockResult({ severity: "low", rotScore: 7 }),
      createMockResult({ severity: "low", rotScore: 8 }),
      createMockResult({ severity: "low", rotScore: 6 }),
    ];
    const result = computeQualityGate(results);
    expect(result.status).toBe("fail");
    expect(result.reason).toContain("Average score");
  });

  it("returns pass when all gates pass", () => {
    const results = [
      createMockResult({ severity: "low", rotScore: 3 }),
      createMockResult({ severity: "low", rotScore: 4 }),
      createMockResult({ severity: "low", rotScore: 2 }),
    ];
    const result = computeQualityGate(results);
    expect(result.status).toBe("pass");
    expect(result.reason).toBe("All quality gates passed");
  });
});

describe("QualityGateBadge", () => {
  it("renders unknown state", () => {
    render(<QualityGateBadge status="unknown" reason="No scan data" />);
    expect(screen.getByText("No Data")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveAttribute("aria-label", "Quality gate status unknown");
  });

  it("renders passing state", () => {
    render(<QualityGateBadge status="pass" reason="All quality gates passed" />);
    expect(screen.getByText("Passing")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveAttribute("aria-label", expect.stringContaining("passing"));
  });

  it("renders failing state", () => {
    render(<QualityGateBadge status="fail" reason="2 severe repos need attention" />);
    expect(screen.getByText("Failing")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveAttribute("aria-label", expect.stringContaining("failing"));
  });
});

describe("QualityGateCard", () => {
  it("renders unknown state with scan button", () => {
    const onStartScan = vi.fn();
    render(<QualityGateCard status="unknown" reason="No scan data" onStartScan={onStartScan} />);
    
    expect(screen.getByText("Ready to scan")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Start Scan/i })).toBeInTheDocument();
  });

  it("calls onStartScan when confirmed in modal", () => {
    const onStartScan = vi.fn();
    render(<QualityGateCard status="unknown" reason="No scan data" onStartScan={onStartScan} />);
    
    // Click the scan button to open modal
    fireEvent.click(screen.getByRole("button", { name: /Start Scan/i }));
    
    // Modal should appear with Cancel and Start Scan buttons
    // Find all Start Scan buttons and click the one in the modal (second one)
    const startScanButtons = screen.getAllByRole("button", { name: /Start Scan/i });
    fireEvent.click(startScanButtons[1]); // Modal confirm button
    expect(onStartScan).toHaveBeenCalled();
  });

  it("shows scanning state when isScanning", () => {
    const scanProgress = {
      status: "running" as const,
      startedAt: new Date().toISOString(),
      totalRepoCount: 10,
      processedRepoCount: 3,
    };
    render(<QualityGateCard status="unknown" reason="No scan data" onStartScan={() => {}} isScanning scanProgress={scanProgress} />);
    
    expect(screen.getByText("Scanning repositories...")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("10")).toBeInTheDocument();
  });

  it("renders passing state", () => {
    render(<QualityGateCard status="pass" reason="All quality gates passed" />);
    
    expect(screen.getByText("Quality Gate Passed")).toBeInTheDocument();
    expect(screen.getByText("All quality gates passed")).toBeInTheDocument();
  });

  it("renders failing state with re-scan button", () => {
    const onStartScan = vi.fn();
    render(<QualityGateCard status="fail" reason="2 severe repos" onStartScan={onStartScan} />);
    
    expect(screen.getByText("Quality Gate Failed")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Fix and scan/i })).toBeInTheDocument();
  });
});

describe("OverviewTab", () => {
  const defaultProps = {
    results: [],
    orgStats: null,
    orgStatsLoading: false,
    lastScanTime: null,
    scanStatusInfo: null,
    isScanning: false,
    relativeTime: mockRelativeTime,
  };

  it("renders empty state with scan button", () => {
    const onStartScan = vi.fn();
    render(<OverviewTab {...defaultProps} onStartScan={onStartScan} />);
    
    expect(screen.getByText("Ready to scan")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Start Scan/i })).toBeInTheDocument();
  });

  it("renders KPI cards when results exist", () => {
    const results = [
      createMockResult({ severity: "severe", rotScore: 12 }),
      createMockResult({ severity: "high", rotScore: 8 }),
      createMockResult({ severity: "low", rotScore: 3 }),
    ];
    render(<OverviewTab {...defaultProps} results={results} />);
    
    expect(screen.getByText("Total Repos")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument(); // total repos
    expect(screen.getByText("Avg Score")).toBeInTheDocument();
    // "Severe" appears multiple times (KPI card label + severity breakdown legend)
    expect(screen.getAllByText("Severe").length).toBeGreaterThan(0);
    expect(screen.getByText("High Risk")).toBeInTheDocument();
  });

  it("renders org stats when provided", () => {
    const results = [createMockResult()];
    const orgStats = createMockOrgStats();
    render(<OverviewTab {...defaultProps} results={results} orgStats={orgStats} />);
    
    expect(screen.getByText("Org Health Overview")).toBeInTheDocument();
    expect(screen.getByText("Top Rot Factors")).toBeInTheDocument();
    expect(screen.getByText("Score Distribution")).toBeInTheDocument();
  });

  it("renders skeleton when orgStatsLoading", () => {
    const results = [createMockResult()];
    render(<OverviewTab {...defaultProps} results={results} orgStatsLoading />);
    
    // OrgStatsSkeleton renders with shimmer-bg class
    const skeleton = document.querySelector(".shimmer-bg");
    expect(skeleton).toBeInTheDocument();
  });

  it("renders last scan time when provided", () => {
    const results = [createMockResult()];
    render(<OverviewTab {...defaultProps} results={results} lastScanTime="2024-01-15T10:00:00Z" />);
    
    expect(screen.getByText(/Last scanned/)).toBeInTheDocument();
    expect(mockRelativeTime).toHaveBeenCalledWith("2024-01-15T10:00:00Z");
  });

  it("renders scan progress when scanning", () => {
    const scanStatusInfo = {
      status: "running" as const,
      startedAt: new Date().toISOString(),
      totalRepoCount: 20,
      processedRepoCount: 5,
    };
    render(<OverviewTab {...defaultProps} isScanning scanStatusInfo={scanStatusInfo} />);
    
    expect(screen.getByText("Scanning repositories...")).toBeInTheDocument();
    // Text is split across elements, check individually
    expect(screen.getByText("5")).toBeInTheDocument();
    expect(screen.getByText("20")).toBeInTheDocument();
    // "repos" appears in text - verify progress is showing
    expect(screen.getByText("25%")).toBeInTheDocument();
  });

  it("renders severity breakdown when results exist", () => {
    const results = [
      createMockResult({ severity: "severe" }),
      createMockResult({ severity: "high" }),
      createMockResult({ severity: "low" }),
      createMockResult({ severity: "low" }),
    ];
    render(<OverviewTab {...defaultProps} results={results} />);
    
    expect(screen.getByText("Severity Breakdown")).toBeInTheDocument();
    // Check legend items
    expect(screen.getAllByText("Severe").length).toBeGreaterThan(0);
    expect(screen.getAllByText("High").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Low").length).toBeGreaterThan(0);
  });

  it("calculates quality gate correctly", () => {
    const results = [
      createMockResult({ severity: "severe", rotScore: 12 }),
    ];
    render(<OverviewTab {...defaultProps} results={results} />);
    
    expect(screen.getByText("Quality Gate Failed")).toBeInTheDocument();
    expect(screen.getByText(/severe.*need attention/i)).toBeInTheDocument();
  });
});
