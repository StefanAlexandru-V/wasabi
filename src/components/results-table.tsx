"use client";

import { useState, useMemo } from "react";
import { relativeTime } from "@/lib/relative-time";
import { useLocalStorage } from "@/lib/use-local-storage";

interface ScanResult {
  rank: number;
  repoName: string;
  rotScore: number;
  severity: string;
  lastCommit: string | null;
  scoreBreakdown: Record<string, number>;
  archived: boolean;
}

type SortField = "rank" | "repoName" | "rotScore" | "severity" | "lastCommit";
type SortDirection = "asc" | "desc";

const severityOrder: Record<string, number> = { severe: 3, high: 2, low: 1 };

type ColumnKey = "vulns" | "branchProt" | "stalePRs";

const columnLabels: Record<ColumnKey, string> = {
  vulns: "Vulns",
  branchProt: "Branch Prot.",
  stalePRs: "Stale PRs",
};

const PAGE_SIZE = 50;

function severityBadge(severity: string) {
  const styles: Record<string, string> = {
    severe: "bg-danger-subtle text-danger border-danger/20",
    high: "bg-severe-subtle text-severe border-severe/20",
    low: "bg-success-subtle text-success border-success/20",
  };
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold uppercase tracking-wider border ${styles[severity] ?? styles.low}`}
    >
      {severity}
    </span>
  );
}

function scoreColor(score: number) {
  if (score >= 10) return "text-danger";
  if (score >= 7) return "text-severe";
  if (score >= 4) return "text-warning";
  return "text-success";
}

function ScoreBar({ score, max = 17 }: { score: number; max?: number }) {
  const pct = Math.min((score / max) * 100, 100);
  const color =
    score >= 10 ? "bg-danger" : score >= 7 ? "bg-severe" : score >= 4 ? "bg-warning" : "bg-success";
  return (
    <div className="flex items-center gap-2">
      <span className={`font-mono text-sm font-semibold tabular-nums ${scoreColor(score)}`}>{score}</span>
      <div className="h-1.5 w-16 rounded-full bg-surface-3 overflow-hidden">
        <div
          className={`h-full rounded-full ${color} transition-all duration-500`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function SortIcon({ active, direction }: { active: boolean; direction: SortDirection }) {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 12 12"
      fill="none"
      className={`shrink-0 transition-colors ${active ? "text-text-secondary" : "text-text-quaternary opacity-0 group-hover:opacity-100"}`}
    >
      <path
        d="M6 2.5L8.5 5.5H3.5L6 2.5Z"
        fill="currentColor"
        className={active && direction === "asc" ? "opacity-100" : "opacity-30"}
      />
      <path
        d="M6 9.5L3.5 6.5H8.5L6 9.5Z"
        fill="currentColor"
        className={active && direction === "desc" ? "opacity-100" : "opacity-30"}
      />
    </svg>
  );
}

function formatCommitDate(lastCommit: string | null) {
  if (!lastCommit) return { display: "N/A", title: undefined };
  return {
    display: relativeTime(lastCommit),
    title: new Date(lastCommit).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    }),
  };
}

function MobileCard({
  result,
  onSelect,
  isSelected,
  isChecked,
  onToggle,
  previousScore,
}: {
  result: ScanResult;
  onSelect: () => void;
  isSelected: boolean;
  isChecked: boolean;
  onToggle: () => void;
  previousScore?: number;
}) {
  const commit = formatCommitDate(result.lastCommit);
  return (
    <div
      className={`w-full text-left p-4 rounded-xl border transition-all duration-200 ${
        isSelected
          ? "bg-surface-2 border-accent/30 glow"
          : "bg-surface-1 border-border-default hover:bg-surface-2 hover:border-border-hover"
      }`}
    >
      <div className="flex items-start gap-2">
        <input
          type="checkbox"
          checked={isChecked}
          onChange={onToggle}
          className="mt-1 shrink-0 accent-accent"
          aria-label={`Select ${result.repoName}`}
        />
        <button onClick={onSelect} className="flex-1 text-left min-w-0">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="text-text-quaternary text-xs font-mono">#{result.rank}</span>
              <span className="font-medium text-sm truncate">{result.repoName}</span>
              {result.archived && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-surface-3 text-text-quaternary font-medium">ARCHIVED</span>
              )}
            </div>
            {severityBadge(result.severity)}
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <ScoreBar score={result.rotScore} />
              <DeltaBadge current={result.rotScore} previous={previousScore} />
            </div>
            <div className="flex items-center gap-2 text-xs text-text-tertiary" title={commit.title}>
              {result.lastCommit ? commit.display : "No commits"}
            </div>
          </div>
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            {result.scoreBreakdown.criticalVulnerabilities > 0 && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-danger-subtle text-danger font-medium">Vulns</span>
            )}
            {result.scoreBreakdown.noBranchProtection > 0 && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-danger-subtle text-danger font-medium">No protection</span>
            )}
            {result.scoreBreakdown.stalePRs > 0 && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-warning-subtle text-warning font-medium">Stale PRs</span>
            )}
            {result.scoreBreakdown.noCI > 0 && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-surface-3 text-text-tertiary font-medium">No CI</span>
            )}
          </div>
        </button>
      </div>
    </div>
  );
}

const severityFilters = ["all", "severe", "high", "low"] as const;
type SeverityFilter = (typeof severityFilters)[number];

function DeltaBadge({ current, previous }: { current: number; previous: number | undefined }) {
  if (previous === undefined) return null;
  const delta = current - previous;
  if (delta === 0) return <span className="text-[10px] text-text-quaternary font-medium">=</span>;
  const isWorse = delta > 0;
  return (
    <span
      className={`inline-flex items-center gap-0.5 text-[10px] font-semibold tabular-nums ${
        isWorse ? "text-danger" : "text-success"
      }`}
      title={`Was ${previous}, now ${current}`}
    >
      {isWorse ? "\u2191" : "\u2193"}{Math.abs(delta)}
    </span>
  );
}

export function ResultsTable({
  results,
  onSelect,
  selected,
  onStartScan,
  selectedRows,
  onToggleRow,
  onSelectAll,
  orgName,
  previousScores,
}: {
  results: ScanResult[];
  onSelect: (r: ScanResult) => void;
  selected: ScanResult | null;
  onStartScan?: () => void;
  selectedRows?: Set<string>;
  onToggleRow?: (repoName: string) => void;
  onSelectAll?: () => void;
  orgName?: string;
  previousScores?: Map<string, number>;
}) {
  const [sortField, setSortField] = useLocalStorage<SortField>("rrd-sort-field", "rank");
  const [sortDirection, setSortDirection] = useLocalStorage<SortDirection>("rrd-sort-dir", "asc");
  const [search, setSearch] = useState("");
  const [severityFilter, setSeverityFilter] = useLocalStorage<SeverityFilter>("rrd-severity-filter", "all");
  const [visibleColumns, setVisibleColumns] = useLocalStorage<Record<ColumnKey, boolean>>("rrd-columns", {
    vulns: true,
    branchProt: true,
    stalePRs: true,
  });
  const [showColumnMenu, setShowColumnMenu] = useState(false);
  const [page, setPage] = useState(0);

  function handleSort(field: SortField) {
    if (sortField === field) {
      setSortDirection((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDirection(field === "rank" ? "asc" : "desc");
    }
    setPage(0);
  }

  const filtered = useMemo(() => {
    let list = results;
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((r) => r.repoName.toLowerCase().includes(q));
    }
    if (severityFilter !== "all") {
      list = list.filter((r) => r.severity === severityFilter);
    }
    return list;
  }, [results, search, severityFilter]);

  const sorted = useMemo(() => {
    const list = [...filtered];
    list.sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case "rank":
          cmp = a.rank - b.rank;
          break;
        case "repoName":
          cmp = a.repoName.localeCompare(b.repoName);
          break;
        case "rotScore":
          cmp = a.rotScore - b.rotScore;
          break;
        case "severity":
          cmp = (severityOrder[a.severity] ?? 0) - (severityOrder[b.severity] ?? 0);
          break;
        case "lastCommit": {
          const aTime = a.lastCommit ? new Date(a.lastCommit).getTime() : 0;
          const bTime = b.lastCommit ? new Date(b.lastCommit).getTime() : 0;
          cmp = aTime - bTime;
          break;
        }
      }
      return sortDirection === "asc" ? cmp : -cmp;
    });
    return list;
  }, [filtered, sortField, sortDirection]);

  const totalPages = Math.ceil(sorted.length / PAGE_SIZE);
  const paged = sorted.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  if (results.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-surface-2 border border-border-default mb-4">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-text-quaternary">
            <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
        <p className="text-text-tertiary text-sm font-medium mb-1">No scan results yet</p>
        <p className="text-text-quaternary text-xs mb-4">
          {orgName
            ? `Run a scan on ${orgName} to see results.`
            : "Select an organization and run a scan."}
        </p>
        {onStartScan && (
          <button
            onClick={onStartScan}
            className="inline-flex items-center gap-2 rounded-lg bg-success px-4 py-2 text-sm font-medium text-white transition-all duration-200 hover:brightness-110 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-success/50 focus-visible:ring-offset-2 focus-visible:ring-offset-surface-0"
          >
            Run Scan
          </button>
        )}
      </div>
    );
  }

  const thClass = "py-3 px-4 text-left text-[11px] font-semibold text-text-quaternary uppercase tracking-wider";

  function SortableHeader({ field, label, className }: { field: SortField; label: string; className?: string }) {
    return (
      <th className={`${thClass} ${className ?? ""}`}>
        <button
          onClick={() => handleSort(field)}
          className="group inline-flex items-center gap-1 hover:text-text-secondary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 rounded"
          aria-label={`Sort by ${label}`}
        >
          {label}
          <SortIcon active={sortField === field} direction={sortDirection} />
        </button>
      </th>
    );
  }

  const allChecked = selectedRows && results.length > 0 && selectedRows.size === results.length;

  return (
    <>
      <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-3">
        <div className="relative flex-1 sm:max-w-xs">
          <label htmlFor="results-search" className="sr-only">Search repositories</label>
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className="absolute left-3 top-1/2 -translate-y-1/2 text-text-quaternary pointer-events-none"
            aria-hidden="true"
          >
            <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <input
            id="results-search"
            type="text"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0); }}
            placeholder="Search repos..."
            className="w-full rounded-lg border border-border-default bg-surface-1 pl-9 pr-3 py-1.5 text-sm placeholder-text-quaternary transition-colors focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/20"
          />
        </div>
        <div className="flex items-center gap-1">
          {severityFilters.map((f) => (
            <button
              key={f}
              onClick={() => { setSeverityFilter(f); setPage(0); }}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all capitalize focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 ${
                severityFilter === f
                  ? f === "severe"
                    ? "bg-danger-subtle text-danger border border-danger/20"
                    : f === "high"
                    ? "bg-severe-subtle text-severe border border-severe/20"
                    : f === "low"
                    ? "bg-success-subtle text-success border border-success/20"
                    : "bg-accent-subtle text-accent border border-accent/20"
                  : "text-text-quaternary hover:text-text-secondary hover:bg-surface-2 border border-transparent"
              }`}
              aria-pressed={severityFilter === f}
            >
              {f}
            </button>
          ))}
        </div>
        <div className="relative">
          <button
            onClick={() => setShowColumnMenu(!showColumnMenu)}
            className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs text-text-quaternary hover:text-text-secondary hover:bg-surface-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
            aria-label="Toggle columns"
            title="Toggle columns"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 3v18M3 12h18M3 6h18M3 18h18" strokeLinecap="round"/>
            </svg>
            Columns
          </button>
          {showColumnMenu && (
            <div className="absolute right-0 top-full mt-1 z-20 w-40 rounded-lg border border-border-default bg-surface-1 shadow-xl py-1 animate-fade-in">
              {(Object.keys(columnLabels) as ColumnKey[]).map((key) => (
                <label
                  key={key}
                  className="flex items-center gap-2 px-3 py-1.5 text-xs text-text-secondary hover:bg-surface-2 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={visibleColumns[key]}
                    onChange={() =>
                      setVisibleColumns((prev) => ({ ...prev, [key]: !prev[key] }))
                    }
                    className="accent-accent"
                  />
                  {columnLabels[key]}
                </label>
              ))}
            </div>
          )}
        </div>
        {(search || severityFilter !== "all") && (
          <span className="text-xs text-text-quaternary">
            {sorted.length} of {results.length} repos
          </span>
        )}
      </div>

      <div className="flex flex-col gap-2 md:hidden">
        {paged.map((r) => (
          <MobileCard
            key={r.repoName}
            result={r}
            onSelect={() => onSelect(r)}
            isSelected={selected?.repoName === r.repoName}
            isChecked={selectedRows?.has(r.repoName) ?? false}
            onToggle={() => onToggleRow?.(r.repoName)}
            previousScore={previousScores?.get(r.repoName)}
          />
        ))}
        {sorted.length === 0 && (
          <p className="text-center text-text-quaternary text-sm py-8">No repos match your filter.</p>
        )}
      </div>

      <div className="overflow-x-auto hidden md:block rounded-xl border border-border-default bg-surface-1">
        <table className="w-full text-sm" role="grid" aria-label="Repository scan results">
          <thead>
            <tr className="border-b border-border-default">
              {onToggleRow && (
                <th className={`${thClass} w-10`}>
                  <input
                    type="checkbox"
                    checked={!!allChecked}
                    onChange={() => onSelectAll?.()}
                    className="accent-accent"
                    aria-label="Select all repos"
                  />
                </th>
              )}
              <SortableHeader field="rank" label="#" className="w-12" />
              <SortableHeader field="repoName" label="Repo" />
              <SortableHeader field="rotScore" label="Score" className="w-32" />
              <SortableHeader field="severity" label="Severity" className="w-24" />
              <SortableHeader field="lastCommit" label="Last Commit" className="w-32" />
              {visibleColumns.vulns && <th className={`${thClass} w-20`}>Vulns</th>}
              {visibleColumns.branchProt && <th className={`${thClass} w-28`}>Branch Prot.</th>}
              {visibleColumns.stalePRs && <th className={`${thClass} w-24`}>Stale PRs</th>}
            </tr>
          </thead>
          <tbody>
            {paged.map((r, idx) => {
              const commit = formatCommitDate(r.lastCommit);
              const isSelected = selected?.repoName === r.repoName;
              const isChecked = selectedRows?.has(r.repoName) ?? false;
              return (
                <tr
                  key={r.repoName}
                  onClick={() => onSelect(r)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onSelect(r);
                    }
                  }}
                  tabIndex={0}
                  role="row"
                  aria-selected={isSelected}
                  style={{ animationDelay: `${idx * 30}ms` }}
                  className={`border-b border-border-subtle last:border-b-0 cursor-pointer transition-all duration-150 animate-fade-in focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent/50 ${
                    isSelected
                      ? "bg-accent-subtle"
                      : "hover:bg-surface-2"
                  }`}
                >
                  {onToggleRow && (
                    <td className="py-3 px-4" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => onToggleRow(r.repoName)}
                        className="accent-accent"
                        aria-label={`Select ${r.repoName}`}
                      />
                    </td>
                  )}
                  <td className="py-3 px-4 font-mono text-xs text-text-quaternary">{r.rank}</td>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-text-primary">{r.repoName}</span>
                      {r.archived && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-surface-3 text-text-quaternary font-medium">ARCHIVED</span>
                      )}
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-1.5">
                      <ScoreBar score={r.rotScore} />
                      <DeltaBadge current={r.rotScore} previous={previousScores?.get(r.repoName)} />
                    </div>
                  </td>
                  <td className="py-3 px-4">{severityBadge(r.severity)}</td>
                  <td className="py-3 px-4 text-text-tertiary text-xs font-mono" title={commit.title}>
                    {commit.display}
                  </td>
                  {visibleColumns.vulns && (
                    <td className="py-3 px-4">
                      {r.scoreBreakdown.criticalVulnerabilities > 0 ? (
                        <span className="inline-flex items-center gap-1 text-danger text-xs font-medium">
                          <span className="h-1.5 w-1.5 rounded-full bg-danger" />
                          Yes
                        </span>
                      ) : (
                        <span className="text-text-quaternary text-xs">No</span>
                      )}
                    </td>
                  )}
                  {visibleColumns.branchProt && (
                    <td className="py-3 px-4">
                      {r.scoreBreakdown.noBranchProtection > 0 ? (
                        <span className="inline-flex items-center gap-1 text-danger text-xs font-medium">
                          <span className="h-1.5 w-1.5 rounded-full bg-danger" />
                          No
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-success text-xs font-medium">
                          <span className="h-1.5 w-1.5 rounded-full bg-success" />
                          Yes
                        </span>
                      )}
                    </td>
                  )}
                  {visibleColumns.stalePRs && (
                    <td className="py-3 px-4">
                      {r.scoreBreakdown.stalePRs > 0 ? (
                        <span className="inline-flex items-center gap-1 text-warning text-xs font-medium">
                          <span className="h-1.5 w-1.5 rounded-full bg-warning" />
                          &gt;5
                        </span>
                      ) : (
                        <span className="text-text-quaternary text-xs">OK</span>
                      )}
                    </td>
                  )}
                </tr>
              );
            })}
            {sorted.length === 0 && (
              <tr>
                <td colSpan={10} className="py-8 text-center text-text-quaternary text-sm">
                  No repos match your filter.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-3">
          <span className="text-xs text-text-quaternary">
            Page {page + 1} of {totalPages}
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              className="px-2.5 py-1 rounded-lg text-xs font-medium border border-border-default bg-surface-1 text-text-secondary transition-colors hover:bg-surface-2 disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
            >
              Prev
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              className="px-2.5 py-1 rounded-lg text-xs font-medium border border-border-default bg-surface-1 text-text-secondary transition-colors hover:bg-surface-2 disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </>
  );
}
