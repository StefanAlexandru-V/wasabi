import { describe, it, expect, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ResultsTable } from "@/components/results-table";

const mockResults = [
  {
    rank: 1,
    repoName: "rotting-repo",
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
  },
  {
    rank: 2,
    repoName: "healthy-repo",
    rotScore: 0,
    severity: "low",
    lastCommit: "2025-06-01T00:00:00Z",
    scoreBreakdown: {
      inactivity: 0,
      criticalVulnerabilities: 0,
      missingCodeowners: 0,
      noBranchProtection: 0,
      stalePRs: 0,
      noCI: 0,
      notArchivedButInactive: 0,
    },
    archived: false,
  },
  {
    rank: 3,
    repoName: "stale-prs-repo",
    rotScore: 4,
    severity: "low",
    lastCommit: null,
    scoreBreakdown: {
      inactivity: 0,
      criticalVulnerabilities: 0,
      missingCodeowners: 2,
      noBranchProtection: 0,
      stalePRs: 2,
      noCI: 0,
      notArchivedButInactive: 0,
    },
    archived: false,
  },
];

describe("ResultsTable", () => {
  it("renders empty state when no results", () => {
    render(
      <ResultsTable results={[]} onSelect={() => {}} selected={null} />
    );
    expect(screen.getByText(/No scan results yet/)).toBeInTheDocument();
  });

  it("renders Run Scan button in empty state when onStartScan provided", async () => {
    const user = userEvent.setup();
    const onStartScan = vi.fn();
    render(
      <ResultsTable results={[]} onSelect={() => {}} selected={null} onStartScan={onStartScan} />
    );
    const btn = screen.getByText("Run Scan");
    expect(btn).toBeInTheDocument();
    await user.click(btn);
    expect(onStartScan).toHaveBeenCalled();
  });

  it("does not render Run Scan button when onStartScan not provided", () => {
    render(
      <ResultsTable results={[]} onSelect={() => {}} selected={null} />
    );
    expect(screen.queryByText("Run Scan")).not.toBeInTheDocument();
  });

  it("renders all result rows", () => {
    render(
      <ResultsTable results={mockResults} onSelect={() => {}} selected={null} />
    );
    expect(screen.getAllByText("rotting-repo")).toHaveLength(2);
    expect(screen.getAllByText("healthy-repo")).toHaveLength(2);
    expect(screen.getAllByText("stale-prs-repo")).toHaveLength(2);
  });

  it("displays severity badges", () => {
    render(
      <ResultsTable results={mockResults} onSelect={() => {}} selected={null} />
    );
    expect(screen.getAllByText("severe").length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText("low").length).toBeGreaterThanOrEqual(2);
  });

  it("displays rot scores", () => {
    render(
      <ResultsTable results={mockResults} onSelect={() => {}} selected={null} />
    );
    expect(screen.getAllByText("12").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("0").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("4").length).toBeGreaterThanOrEqual(1);
  });

  it("displays N/A for null lastCommit in desktop table", () => {
    render(
      <ResultsTable results={mockResults} onSelect={() => {}} selected={null} />
    );
    expect(screen.getByText("N/A")).toBeInTheDocument();
  });

  it("displays relative time for lastCommit", () => {
    render(
      <ResultsTable results={mockResults} onSelect={() => {}} selected={null} />
    );
    const table = document.querySelector("table");
    expect(table).toBeTruthy();
    const row = within(table!).getByText("rotting-repo").closest("tr");
    expect(row).toBeTruthy();
    const cells = row!.querySelectorAll("td");
    const commitCell = cells[4];
    expect(commitCell.textContent).toMatch(/ago$/);
  });

  it("shows vulnerability indicator", () => {
    render(
      <ResultsTable results={mockResults} onSelect={() => {}} selected={null} />
    );
    expect(screen.getAllByText("Yes").length).toBeGreaterThanOrEqual(1);
  });

  it("shows stale PR indicator", () => {
    render(
      <ResultsTable results={mockResults} onSelect={() => {}} selected={null} />
    );
    expect(screen.getByText(">5")).toBeInTheDocument();
    expect(screen.getAllByText("Stale PRs").length).toBeGreaterThanOrEqual(1);
  });

  it("calls onSelect when a result is clicked", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(
      <ResultsTable results={mockResults} onSelect={onSelect} selected={null} />
    );
    const rottingRepos = screen.getAllByText("rotting-repo");
    await user.click(rottingRepos[0]);
    expect(onSelect).toHaveBeenCalledWith(mockResults[0]);
  });

  it("highlights selected result in desktop table", () => {
    render(
      <ResultsTable
        results={mockResults}
        onSelect={() => {}}
        selected={mockResults[0]}
      />
    );
    const table = document.querySelector("table");
    expect(table).toBeTruthy();
    const row = within(table!).getByText("rotting-repo").closest("tr");
    expect(row?.className).toContain("bg-accent-subtle");
  });

  it("renders sortable table headers in desktop view", () => {
    render(
      <ResultsTable results={mockResults} onSelect={() => {}} selected={null} />
    );
    const table = document.querySelector("table");
    expect(table).toBeTruthy();
    const thead = within(table!);
    expect(thead.getByText("Repo")).toBeInTheDocument();
    expect(thead.getByText("Score")).toBeInTheDocument();
    expect(thead.getByText("Severity")).toBeInTheDocument();
    expect(thead.getByText("Last Commit")).toBeInTheDocument();
    expect(thead.getByText("Vulns")).toBeInTheDocument();
    expect(thead.getByText("Branch Prot.")).toBeInTheDocument();
  });

  it("renders mobile cards with key info", () => {
    render(
      <ResultsTable results={mockResults} onSelect={() => {}} selected={null} />
    );
    expect(screen.getAllByText("Vulns").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("No commits")).toBeInTheDocument();
  });

  it("renders search input", () => {
    render(
      <ResultsTable results={mockResults} onSelect={() => {}} selected={null} />
    );
    expect(screen.getByPlaceholderText("Search repos...")).toBeInTheDocument();
  });

  it("filters results by search query", async () => {
    const user = userEvent.setup();
    render(
      <ResultsTable results={mockResults} onSelect={() => {}} selected={null} />
    );
    const input = screen.getByPlaceholderText("Search repos...");
    await user.type(input, "rotting");
    const table = document.querySelector("table");
    const rows = table!.querySelectorAll("tbody tr");
    expect(rows).toHaveLength(1);
    expect(within(rows[0] as HTMLElement).getByText("rotting-repo")).toBeInTheDocument();
  });

  it("renders severity filter pills", () => {
    render(
      <ResultsTable results={mockResults} onSelect={() => {}} selected={null} />
    );
    expect(screen.getByText("all")).toBeInTheDocument();
    expect(screen.getAllByText("severe").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("high").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("low").length).toBeGreaterThanOrEqual(1);
  });

  it("filters results by severity", async () => {
    const user = userEvent.setup();
    render(
      <ResultsTable results={mockResults} onSelect={() => {}} selected={null} />
    );
    const severeBtns = screen.getAllByText("severe");
    const filterBtn = severeBtns.find((el) => el.tagName === "BUTTON");
    expect(filterBtn).toBeTruthy();
    await user.click(filterBtn!);
    const table = document.querySelector("table");
    const rows = table!.querySelectorAll("tbody tr");
    expect(rows).toHaveLength(1);
    expect(within(rows[0] as HTMLElement).getByText("rotting-repo")).toBeInTheDocument();
  });

  it("sorts by score when Score header clicked", async () => {
    const user = userEvent.setup();
    render(
      <ResultsTable results={mockResults} onSelect={() => {}} selected={null} />
    );
    const table = document.querySelector("table")!;
    const scoreHeader = within(table).getByRole("button", { name: /Sort by Score/ });
    await user.click(scoreHeader);
    const rows = table.querySelectorAll("tbody tr");
    const firstRowText = rows[0].textContent;
    expect(firstRowText).toContain("rotting-repo");
  });

  it("makes rows keyboard-navigable", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(
      <ResultsTable results={mockResults} onSelect={onSelect} selected={null} />
    );
    const table = document.querySelector("table")!;
    const firstRow = table.querySelector("tbody tr")!;
    firstRow.focus();
    await user.keyboard("{Enter}");
    expect(onSelect).toHaveBeenCalledWith(mockResults[0]);
  });

  it("shows filtered count when search active", async () => {
    const user = userEvent.setup();
    render(
      <ResultsTable results={mockResults} onSelect={() => {}} selected={null} />
    );
    const input = screen.getByPlaceholderText("Search repos...");
    await user.type(input, "rotting");
    expect(screen.getByText("1 of 3 repos")).toBeInTheDocument();
  });
});
