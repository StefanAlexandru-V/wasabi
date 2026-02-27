import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { HistoryTab } from "../history-tab";
import type { ScanHistoryItem, ScanDiff } from "../types";

vi.mock("../../skeletons", () => ({
  ScanHistorySkeleton: () => <div data-testid="skeleton">Loading...</div>,
}));

const mockRelativeTime = vi.fn((date: string) => `relative(${date})`);

const createMockScan = (overrides: Partial<ScanHistoryItem> = {}): ScanHistoryItem => ({
  id: "scan-1",
  status: "completed",
  startedAt: "2024-01-15T10:00:00Z",
  completedAt: "2024-01-15T10:01:00Z",
  repoCount: 10,
  ...overrides,
});

const createMockDiff = (): ScanDiff => ({
  scanA: { id: "scan-1", startedAt: "2024-01-14T10:00:00Z", completedAt: "2024-01-14T10:01:00Z", repoCount: 10 },
  scanB: { id: "scan-2", startedAt: "2024-01-15T10:00:00Z", completedAt: "2024-01-15T10:01:00Z", repoCount: 10 },
  summary: { improved: 3, worsened: 2, unchanged: 5, added: 0, removed: 0 },
  diff: [
    { repoName: "repo-1", scoreA: 5, scoreB: 3, delta: -2, severityA: "low", severityB: "low", status: "improved" },
    { repoName: "repo-2", scoreA: 3, scoreB: 5, delta: 2, severityA: "low", severityB: "high", status: "worsened" },
  ],
});

describe("HistoryTab", () => {
  const defaultProps = {
    scanHistory: [] as ScanHistoryItem[],
    scanHistoryLoading: false,
    currentScanId: null,
    onSelectScan: vi.fn(),
    completedScans: [] as ScanHistoryItem[],
    scanDiff: null,
    onLoadDiff: vi.fn(),
    onCloseDiff: vi.fn(),
    relativeTime: mockRelativeTime,
  };

  it("renders loading skeleton when loading", () => {
    render(<HistoryTab {...defaultProps} scanHistoryLoading />);
    expect(screen.getByTestId("skeleton")).toBeInTheDocument();
  });

  it("renders empty state when no history", () => {
    render(<HistoryTab {...defaultProps} />);
    expect(screen.getByText("No scan history yet")).toBeInTheDocument();
  });

  it("renders scan timeline when history exists", () => {
    const scanHistory = [createMockScan()];
    render(<HistoryTab {...defaultProps} scanHistory={scanHistory} />);
    
    expect(screen.getByText("Scan Timeline")).toBeInTheDocument();
    expect(screen.getByText("1 scan")).toBeInTheDocument();
  });

  it("marks latest scan with LATEST badge", () => {
    const scanHistory = [
      createMockScan({ id: "scan-1" }),
      createMockScan({ id: "scan-2" }),
    ];
    render(<HistoryTab {...defaultProps} scanHistory={scanHistory} />);
    
    expect(screen.getByText("LATEST")).toBeInTheDocument();
  });

  it("marks current scan with VIEWING badge", () => {
    const scanHistory = [
      createMockScan({ id: "scan-1" }),
      createMockScan({ id: "scan-2" }),
    ];
    render(<HistoryTab {...defaultProps} scanHistory={scanHistory} currentScanId="scan-2" />);
    
    expect(screen.getByText("VIEWING")).toBeInTheDocument();
  });

  it("calls onSelectScan when scan is clicked", () => {
    const onSelectScan = vi.fn();
    const scanHistory = [createMockScan({ id: "scan-1" })];
    render(<HistoryTab {...defaultProps} scanHistory={scanHistory} onSelectScan={onSelectScan} />);
    
    fireEvent.click(screen.getByRole("button", { name: /relative/i }));
    expect(onSelectScan).toHaveBeenCalledWith("scan-1");
  });

  it("renders compare section when 2+ completed scans", () => {
    const scanHistory = [
      createMockScan({ id: "scan-1" }),
      createMockScan({ id: "scan-2" }),
    ];
    const completedScans = scanHistory;
    render(<HistoryTab {...defaultProps} scanHistory={scanHistory} completedScans={completedScans} />);
    
    expect(screen.getByText("Compare Scans")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Compare" })).toBeInTheDocument();
  });

  it("disables compare button when scans not selected", () => {
    const scanHistory = [
      createMockScan({ id: "scan-1" }),
      createMockScan({ id: "scan-2" }),
    ];
    render(<HistoryTab {...defaultProps} scanHistory={scanHistory} completedScans={scanHistory} />);
    
    expect(screen.getByRole("button", { name: "Compare" })).toBeDisabled();
  });

  it("renders diff panel when scanDiff provided", () => {
    const scanHistory = [createMockScan()];
    const scanDiff = createMockDiff();
    render(<HistoryTab {...defaultProps} scanHistory={scanHistory} scanDiff={scanDiff} />);
    
    expect(screen.getByText(/Diff:/)).toBeInTheDocument();
    // Numbers appear multiple times (in summary and table), use getAllByText
    expect(screen.getAllByText("3").length).toBeGreaterThan(0); // improved count (also in table as scoreB)
    expect(screen.getByText("Improved")).toBeInTheDocument();
    expect(screen.getByText("Worsened")).toBeInTheDocument();
  });

  it("calls onCloseDiff when close button clicked", () => {
    const onCloseDiff = vi.fn();
    const scanHistory = [createMockScan()];
    const scanDiff = createMockDiff();
    render(<HistoryTab {...defaultProps} scanHistory={scanHistory} scanDiff={scanDiff} onCloseDiff={onCloseDiff} />);
    
    fireEvent.click(screen.getByRole("button", { name: "Close diff" }));
    expect(onCloseDiff).toHaveBeenCalled();
  });

  it("displays scan duration", () => {
    const scanHistory = [createMockScan({
      startedAt: "2024-01-15T10:00:00Z",
      completedAt: "2024-01-15T10:01:30Z",
    })];
    render(<HistoryTab {...defaultProps} scanHistory={scanHistory} />);
    
    expect(screen.getByText("1m 30s")).toBeInTheDocument();
  });

  it("displays status indicators", () => {
    const scanHistory = [
      createMockScan({ id: "scan-1", status: "completed" }),
      createMockScan({ id: "scan-2", status: "failed" }),
      createMockScan({ id: "scan-3", status: "running" }),
    ];
    render(<HistoryTab {...defaultProps} scanHistory={scanHistory} />);
    
    expect(screen.getByText("completed")).toBeInTheDocument();
    expect(screen.getByText("failed")).toBeInTheDocument();
    expect(screen.getByText("running")).toBeInTheDocument();
  });
});
