import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ScorePanel } from "@/components/score-panel";

const mockResult = {
  rank: 1,
  repoName: "my-rotting-repo",
  rotScore: 12,
  severity: "severe",
  lastCommit: "2024-01-01T00:00:00Z",
  scoreBreakdown: {
    inactivity: 3,
    criticalVulnerabilities: 4,
    missingCodeowners: 2,
    noBranchProtection: 0,
    stalePRs: 0,
    noCI: 0,
    notArchivedButInactive: 3,
  },
  archived: false,
};

describe("ScorePanel", () => {
  it("renders repo name", () => {
    render(<ScorePanel result={mockResult} onClose={() => {}} />);
    expect(screen.getByText("my-rotting-repo")).toBeInTheDocument();
  });

  it("renders rot score", () => {
    render(<ScorePanel result={mockResult} onClose={() => {}} />);
    expect(screen.getByText("12")).toBeInTheDocument();
  });

  it("renders severity badge", () => {
    render(<ScorePanel result={mockResult} onClose={() => {}} />);
    expect(screen.getByText("severe")).toBeInTheDocument();
  });

  it("renders human-readable breakdown labels", () => {
    render(<ScorePanel result={mockResult} onClose={() => {}} />);
    expect(screen.getByText("Inactivity (>6 months)")).toBeInTheDocument();
    expect(screen.getByText("Critical Vulnerabilities")).toBeInTheDocument();
    expect(screen.getByText("Missing CODEOWNERS")).toBeInTheDocument();
    expect(screen.getByText("No Branch Protection")).toBeInTheDocument();
    expect(screen.getByText("Stale PRs (>5 open >30 days)")).toBeInTheDocument();
    expect(screen.getByText("No CI Workflows")).toBeInTheDocument();
    expect(screen.getByText("Not Archived but Inactive")).toBeInTheDocument();
  });

  it("renders breakdown values with + prefix", () => {
    render(<ScorePanel result={mockResult} onClose={() => {}} />);
    const allValues = screen.getAllByText(/^\+\d+$/);
    expect(allValues.length).toBe(7);
    expect(screen.getByText("+4")).toBeInTheDocument();
    expect(screen.getAllByText("+3")).toHaveLength(2);
    expect(screen.getByText("+2")).toBeInTheDocument();
    expect(screen.getAllByText("+0")).toHaveLength(3);
  });

  it("renders last commit date", () => {
    render(<ScorePanel result={mockResult} onClose={() => {}} />);
    const dateEl = screen.getByText(/Last commit/);
    expect(dateEl).toBeInTheDocument();
  });

  it("renders archived status", () => {
    render(<ScorePanel result={mockResult} onClose={() => {}} />);
    expect(screen.getByText("Archived:")).toBeInTheDocument();
    expect(screen.getByText("No")).toBeInTheDocument();
  });

  it("renders archived Yes for archived repos", () => {
    const archivedResult = { ...mockResult, archived: true };
    render(<ScorePanel result={archivedResult} onClose={() => {}} />);
    expect(screen.getByText("Archived:")).toBeInTheDocument();
    expect(screen.getByText("Yes")).toBeInTheDocument();
  });

  it("calls onClose when close button clicked", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<ScorePanel result={mockResult} onClose={onClose} />);
    await user.click(screen.getByText("×"));
    expect(onClose).toHaveBeenCalled();
  });

  it("renders N/A for null lastCommit", () => {
    const nullDateResult = { ...mockResult, lastCommit: null };
    render(<ScorePanel result={nullDateResult} onClose={() => {}} />);
    expect(screen.getByText(/N\/A/)).toBeInTheDocument();
  });

  it("renders severity-specific styling for high", () => {
    const highResult = { ...mockResult, severity: "high", rotScore: 8 };
    render(<ScorePanel result={highResult} onClose={() => {}} />);
    expect(screen.getByText("high")).toBeInTheDocument();
  });

  it("renders severity-specific styling for low", () => {
    const lowResult = { ...mockResult, severity: "low", rotScore: 2 };
    render(<ScorePanel result={lowResult} onClose={() => {}} />);
    expect(screen.getByText("low")).toBeInTheDocument();
  });
});
