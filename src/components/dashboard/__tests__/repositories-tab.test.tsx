import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { RepositoriesTab } from "../repositories-tab";
import type { ScanResult } from "../types";

// Mock the child components
vi.mock("../../results-table", () => ({
  ResultsTable: ({ results, onSelect, selected }: { results: ScanResult[]; onSelect: (r: ScanResult) => void; selected: ScanResult | null }) => (
    <div data-testid="results-table">
      <span>Results: {results.length}</span>
      {results.map(r => (
        <button key={r.repoName} onClick={() => onSelect(r)} data-selected={selected?.repoName === r.repoName}>
          {r.repoName}
        </button>
      ))}
    </div>
  ),
}));

vi.mock("../../score-panel", () => ({
  ScorePanel: ({ result, onClose }: { result: ScanResult; onClose: () => void }) => (
    <div data-testid="score-panel">
      <span>Panel: {result.repoName}</span>
      <button onClick={onClose}>Close</button>
    </div>
  ),
}));

vi.mock("../../skeletons", () => ({
  TableSkeleton: () => <div data-testid="table-skeleton">Loading...</div>,
}));

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

describe("RepositoriesTab", () => {
  const defaultProps = {
    results: [] as ScanResult[],
    selectedResult: null,
    onSelectResult: vi.fn(),
    selectedRows: new Set<string>(),
    onToggleRow: vi.fn(),
    onSelectAll: vi.fn(),
    orgName: "test-org",
    previousScores: new Map<string, number>(),
    resultsLoading: false,
    isScanning: false,
    onExportSelected: vi.fn(),
  };

  it("renders loading skeleton when loading", () => {
    render(<RepositoriesTab {...defaultProps} resultsLoading />);
    expect(screen.getByTestId("table-skeleton")).toBeInTheDocument();
  });

  it("renders results table when not loading", () => {
    const results = [createMockResult()];
    render(<RepositoriesTab {...defaultProps} results={results} />);
    expect(screen.getByTestId("results-table")).toBeInTheDocument();
  });

  it("renders bulk actions bar when rows are selected", () => {
    const results = [createMockResult()];
    const selectedRows = new Set(["test-repo"]);
    render(<RepositoriesTab {...defaultProps} results={results} selectedRows={selectedRows} />);
    
    expect(screen.getByText("1 repo selected")).toBeInTheDocument();
    expect(screen.getByText("Export CSV")).toBeInTheDocument();
  });

  it("calls onExportSelected when export button clicked", () => {
    const onExportSelected = vi.fn();
    const results = [createMockResult()];
    const selectedRows = new Set(["test-repo"]);
    render(<RepositoriesTab {...defaultProps} results={results} selectedRows={selectedRows} onExportSelected={onExportSelected} />);
    
    fireEvent.click(screen.getByText("Export CSV"));
    expect(onExportSelected).toHaveBeenCalled();
  });

  it("renders comparison panel when 2+ repos selected", () => {
    const results = [
      createMockResult({ repoName: "repo-1" }),
      createMockResult({ repoName: "repo-2" }),
    ];
    const selectedRows = new Set(["repo-1", "repo-2"]);
    render(<RepositoriesTab {...defaultProps} results={results} selectedRows={selectedRows} />);
    
    expect(screen.getByText("Side-by-Side Comparison")).toBeInTheDocument();
  });

  it("renders score panel when a result is selected", () => {
    const results = [createMockResult()];
    const selectedResult = results[0];
    render(<RepositoriesTab {...defaultProps} results={results} selectedResult={selectedResult} />);
    
    expect(screen.getByTestId("score-panel")).toBeInTheDocument();
  });

  it("pluralizes correctly for multiple repos", () => {
    const results = [
      createMockResult({ repoName: "repo-1" }),
      createMockResult({ repoName: "repo-2" }),
    ];
    const selectedRows = new Set(["repo-1", "repo-2"]);
    render(<RepositoriesTab {...defaultProps} results={results} selectedRows={selectedRows} />);
    
    expect(screen.getByText("2 repos selected")).toBeInTheDocument();
  });
});
