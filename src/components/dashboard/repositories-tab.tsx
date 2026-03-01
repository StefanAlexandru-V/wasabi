"use client";

import { useMemo, useEffect } from "react";
import { ResultsTable } from "../results-table";
import { ScorePanel } from "../score-panel";
import { TableSkeleton } from "../skeletons";
import type { ScanResult } from "./types";

interface RepositoriesTabProps {
  results: ScanResult[];
  selectedResult: ScanResult | null;
  onSelectResult: (result: ScanResult | null) => void;
  selectedRows: Set<string>;
  onToggleRow: (repoName: string) => void;
  onSelectAll: () => void;
  orgName: string;
  previousScores: Map<string, number>;
  resultsLoading: boolean;
  isScanning: boolean;
  onStartScan?: () => void;
  onExportSelected: () => void;
}

export function RepositoriesTab({
  results,
  selectedResult,
  onSelectResult,
  selectedRows,
  onToggleRow,
  onSelectAll,
  orgName,
  previousScores,
  resultsLoading,
  isScanning,
  onStartScan,
  onExportSelected,
}: RepositoriesTabProps) {
  const compareResults = useMemo(() => {
    return results.filter((r) => selectedRows.has(r.repoName)).slice(0, 5);
  }, [results, selectedRows]);

  // Lock body scroll when mobile modal is open
  useEffect(() => {
    if (selectedResult && window.innerWidth < 1024) {
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = "";
      };
    }
  }, [selectedResult]);

  if (resultsLoading && results.length === 0) {
    return <TableSkeleton />;
  }

  return (
    <div className="space-y-4">
      {/* Bulk Actions Bar */}
      {selectedRows.size > 0 && (
        <BulkActionsBar
          selectedCount={selectedRows.size}
          onExport={onExportSelected}
          onClear={() => {
            // Clear all selections
            selectedRows.forEach((name) => onToggleRow(name));
          }}
        />
      )}

      {/* Comparison Panel */}
      {compareResults.length >= 2 && (
        <ComparisonPanel results={compareResults} />
      )}

      {/* Main Table + Detail Panel */}
      <div className="flex flex-col lg:flex-row lg:items-start gap-4 lg:gap-6">
        <div className="flex-1 min-w-0">
          <ResultsTable
            results={results}
            onSelect={onSelectResult}
            selected={selectedResult}
            onStartScan={!isScanning && results.length === 0 ? onStartScan : undefined}
            selectedRows={selectedRows}
            onToggleRow={onToggleRow}
            onSelectAll={onSelectAll}
            orgName={orgName}
            previousScores={previousScores}
          />
        </div>
        
        {/* Desktop: Side panel */}
        {selectedResult && (
          <div className="hidden lg:block lg:sticky lg:top-20">
            <ScorePanel
              result={selectedResult}
              onClose={() => onSelectResult(null)}
              orgName={orgName}
            />
          </div>
        )}
      </div>

      {/* Mobile: Bottom sheet modal */}
      {selectedResult && (
        <MobileScoreModal
          result={selectedResult}
          onClose={() => onSelectResult(null)}
          orgName={orgName}
        />
      )}
    </div>
  );
}

// Mobile bottom sheet modal
function MobileScoreModal({
  result,
  onClose,
  orgName,
}: {
  result: ScanResult;
  onClose: () => void;
  orgName: string;
}) {
  return (
    <div className="lg:hidden fixed inset-0 z-[70]">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-surface-0/80 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
        aria-hidden="true"
      />
      {/* Sheet */}
      <div 
        className="absolute bottom-0 left-0 right-0 max-h-[85vh] overflow-y-auto rounded-t-2xl bg-surface-1 border-t border-border-default shadow-2xl animate-slide-up"
        role="dialog"
        aria-modal="true"
        aria-label={`Score details for ${result.repoName}`}
      >
        {/* Drag handle */}
        <div className="sticky top-0 flex justify-center py-3 bg-surface-1 border-b border-border-subtle">
          <div className="w-10 h-1 rounded-full bg-surface-4" />
        </div>
        <ScorePanel
          result={result}
          onClose={onClose}
          orgName={orgName}
        />
      </div>
    </div>
  );
}

// Sub-components

interface BulkActionsBarProps {
  selectedCount: number;
  onExport: () => void;
  onClear: () => void;
}

function BulkActionsBar({ selectedCount, onExport, onClear }: BulkActionsBarProps) {
  return (
    <div 
      className="flex items-center gap-3 px-4 py-2.5 rounded-lg border border-accent/20 bg-accent-subtle animate-fade-in"
      role="toolbar"
      aria-label="Bulk actions"
    >
      <span className="text-sm font-medium text-accent">
        {selectedCount} {selectedCount === 1 ? "repo" : "repos"} selected
      </span>
      <div className="h-4 w-px bg-accent/20" />
      <button
        onClick={onExport}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-accent hover:text-accent-hover transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 rounded px-2 py-1"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        Export CSV
      </button>
      <button
        onClick={onClear}
        className="text-sm text-text-tertiary hover:text-text-secondary transition-colors rounded px-2 py-1"
      >
        Clear
      </button>
    </div>
  );
}

interface ComparisonPanelProps {
  results: ScanResult[];
}

function ComparisonPanel({ results }: ComparisonPanelProps) {
  const factors = Object.keys(results[0]?.scoreBreakdown ?? {});

  return (
    <div className="rounded-xl border border-border-default bg-surface-1 overflow-hidden animate-fade-in-up">
      <div className="px-4 py-2.5 border-b border-border-subtle bg-surface-2/50">
        <h3 className="text-xs font-semibold text-text-tertiary uppercase tracking-wider">
          Side-by-Side Comparison
        </h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border-subtle">
              <th className="text-left py-2.5 px-4 text-xs font-semibold text-text-quaternary uppercase tracking-wider">
                Factor
              </th>
              {results.map((r) => (
                <th 
                  key={r.repoName} 
                  className="text-center py-2.5 px-4 text-xs font-semibold text-text-secondary min-w-[120px]"
                >
                  {r.repoName}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {/* Total Score Row */}
            <tr className="border-b border-border-subtle bg-surface-2/30">
              <td className="py-2.5 px-4 text-xs font-semibold text-text-secondary">Total Score</td>
              {results.map((r) => (
                <td 
                  key={r.repoName} 
                  className={`text-center py-2.5 px-4 font-mono font-bold text-sm ${
                    r.rotScore >= 10 ? "text-danger" : r.rotScore >= 7 ? "text-severe" : "text-success"
                  }`}
                >
                  {r.rotScore}
                </td>
              ))}
            </tr>
            {/* Severity Row */}
            <tr className="border-b border-border-subtle">
              <td className="py-2.5 px-4 text-xs text-text-tertiary">Severity</td>
              {results.map((r) => (
                <td key={r.repoName} className="text-center py-2.5 px-4">
                  <SeverityPill severity={r.severity} />
                </td>
              ))}
            </tr>
            {/* Factor Rows */}
            {factors.map((factor) => (
              <tr key={factor} className="border-b border-border-subtle last:border-b-0">
                <td className="py-2.5 px-4 text-xs text-text-tertiary capitalize">
                  {formatFactorName(factor)}
                </td>
                {results.map((r) => {
                  const value = r.scoreBreakdown[factor] ?? 0;
                  return (
                    <td 
                      key={r.repoName} 
                      className={`text-center py-2.5 px-4 font-mono text-xs ${
                        value > 0 ? "text-danger font-medium" : "text-text-quaternary"
                      }`}
                    >
                      {value > 0 ? `+${value}` : "—"}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SeverityPill({ severity }: { severity: string }) {
  const styles: Record<string, string> = {
    severe: "bg-danger-subtle text-danger border-danger/20",
    high: "bg-severe-subtle text-severe border-severe/20",
    low: "bg-success-subtle text-success border-success/20",
  };

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold uppercase border ${styles[severity] ?? styles.low}`}>
      {severity}
    </span>
  );
}

function formatFactorName(factor: string): string {
  const labels: Record<string, string> = {
    inactivity: "Inactivity",
    criticalVulnerabilities: "Critical Vulns",
    missingCodeowners: "Missing CODEOWNERS",
    noBranchProtection: "No Branch Protection",
    stalePRs: "Stale PRs",
    noCI: "No CI",
    notArchivedButInactive: "Inactive & Not Archived",
  };
  return labels[factor] ?? factor.replace(/([A-Z])/g, " $1").trim();
}
