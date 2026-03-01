"use client";

import { useState } from "react";
import { ScanHistorySkeleton } from "../skeletons";
import type { ScanHistoryItem, ScanDiff } from "./types";

interface HistoryTabProps {
  scanHistory: ScanHistoryItem[];
  scanHistoryLoading: boolean;
  currentScanId: string | null;
  onSelectScan: (id: string) => void;
  completedScans: ScanHistoryItem[];
  scanDiff: ScanDiff | null;
  onLoadDiff: (scanA: string, scanB: string) => void;
  onCloseDiff: () => void;
  relativeTime: (date: string) => string;
}

export function HistoryTab({
  scanHistory,
  scanHistoryLoading,
  currentScanId,
  onSelectScan,
  completedScans,
  scanDiff,
  onLoadDiff,
  onCloseDiff,
  relativeTime,
}: HistoryTabProps) {
  const [diffScanA, setDiffScanA] = useState("");
  const [diffScanB, setDiffScanB] = useState("");

  const handleCompare = () => {
    if (diffScanA && diffScanB && diffScanA !== diffScanB) {
      onLoadDiff(diffScanA, diffScanB);
    }
  };

  if (scanHistoryLoading) {
    return <ScanHistorySkeleton />;
  }

  if (scanHistory.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-surface-2 border border-border-default mb-4">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-text-quaternary">
            <path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
        <p className="text-text-tertiary text-sm font-medium mb-1">No scan history yet</p>
        <p className="text-text-quaternary text-xs">
          Run your first scan to start tracking changes over time.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Scan Timeline */}
      <div className="rounded-xl border border-border-default bg-surface-1 overflow-hidden">
        <div className="px-5 py-3 border-b border-border-subtle bg-surface-2/50">
          <h3 className="text-xs font-semibold text-text-tertiary uppercase tracking-wider">
            Scan Timeline
            <span className="ml-2 font-mono text-text-quaternary normal-case">
              {scanHistory.length} {scanHistory.length === 1 ? "scan" : "scans"}
            </span>
          </h3>
        </div>
        <div className="divide-y divide-border-subtle">
          {scanHistory.map((scan, index) => (
            <ScanTimelineItem
              key={scan.id}
              scan={scan}
              isCurrentScan={currentScanId === scan.id}
              isLatest={index === 0}
              onSelect={() => onSelectScan(scan.id)}
              relativeTime={relativeTime}
            />
          ))}
        </div>
      </div>

      {/* Compare Scans */}
      {completedScans.length >= 2 && (
        <div className="rounded-xl border border-border-default bg-surface-1 overflow-hidden">
          <div className="px-5 py-3 border-b border-border-subtle bg-surface-2/50">
            <h3 className="text-xs font-semibold text-text-tertiary uppercase tracking-wider">Compare Scans</h3>
          </div>
          <div className="p-5 space-y-4">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1">
                <label className="block text-xs text-text-quaternary mb-1.5">Older scan (before)</label>
                <select
                  value={diffScanA}
                  onChange={(e) => setDiffScanA(e.target.value)}
                  className="w-full rounded-lg border border-border-default bg-surface-0 px-3 py-2 text-sm text-text-secondary focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/20"
                  aria-label="Select older scan to compare"
                >
                  <option value="">Select scan...</option>
                  {completedScans.map((s) => (
                    <option key={s.id} value={s.id}>
                      {relativeTime(s.startedAt)} ({s.repoCount} repos)
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex-1">
                <label className="block text-xs text-text-quaternary mb-1.5">Newer scan (after)</label>
                <select
                  value={diffScanB}
                  onChange={(e) => setDiffScanB(e.target.value)}
                  className="w-full rounded-lg border border-border-default bg-surface-0 px-3 py-2 text-sm text-text-secondary focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/20"
                  aria-label="Select newer scan to compare"
                >
                  <option value="">Select scan...</option>
                  {completedScans.map((s) => (
                    <option key={s.id} value={s.id}>
                      {relativeTime(s.startedAt)} ({s.repoCount} repos)
                    </option>
                  ))}
                </select>
              </div>
              <div className="sm:self-end">
                <button
                  onClick={handleCompare}
                  disabled={!diffScanA || !diffScanB || diffScanA === diffScanB}
                  className="w-full sm:w-auto px-4 py-2 rounded-lg bg-accent text-white text-on-color text-sm font-medium transition-all hover:bg-accent-hover disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
                >
                  Compare
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Diff Results */}
      {scanDiff && (
        <ScanDiffPanel diff={scanDiff} onClose={onCloseDiff} relativeTime={relativeTime} />
      )}
    </div>
  );
}

// Sub-components

interface ScanTimelineItemProps {
  scan: ScanHistoryItem;
  isCurrentScan: boolean;
  isLatest: boolean;
  onSelect: () => void;
  relativeTime: (date: string) => string;
}

function ScanTimelineItem({ scan, isCurrentScan, isLatest, onSelect, relativeTime }: ScanTimelineItemProps) {
  const statusColors: Record<string, string> = {
    completed: "bg-success",
    failed: "bg-danger",
    running: "bg-warning",
    queued: "bg-warning",
  };

  return (
    <button
      onClick={onSelect}
      className={`
        w-full text-left px-5 py-4 transition-colors
        hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent/50
        ${isCurrentScan ? "bg-accent-subtle" : ""}
      `}
      aria-current={isCurrentScan ? "true" : undefined}
    >
      <div className="flex items-center gap-4">
        {/* Status Indicator */}
        <div className="relative shrink-0">
          <span 
            className={`block h-3 w-3 rounded-full ${statusColors[scan.status] ?? "bg-surface-4"}`}
            aria-hidden="true"
          />
          {(scan.status === "running" || scan.status === "queued") && (
            <span className="absolute inset-0 rounded-full bg-warning animate-ping opacity-75" />
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-sm font-medium text-text-primary">
              {relativeTime(scan.startedAt)}
            </span>
            {isLatest && (
              <span className="text-xs px-1.5 py-0.5 rounded bg-accent-subtle text-accent font-medium">
                LATEST
              </span>
            )}
            {isCurrentScan && !isLatest && (
              <span className="text-xs px-1.5 py-0.5 rounded bg-surface-3 text-text-tertiary font-medium">
                VIEWING
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 text-xs text-text-tertiary">
            <span className="capitalize">{scan.status}</span>
            <span>·</span>
            <span className="font-mono">{scan.repoCount} repos</span>
            {scan.completedAt && (
              <>
                <span>·</span>
                <span>
                  {formatDuration(new Date(scan.startedAt), new Date(scan.completedAt))}
                </span>
              </>
            )}
          </div>
        </div>

        {/* Arrow */}
        <svg 
          width="16" 
          height="16" 
          viewBox="0 0 24 24" 
          fill="none" 
          stroke="currentColor" 
          strokeWidth="2"
          className="text-text-quaternary shrink-0"
          aria-hidden="true"
        >
          <path d="M9 18l6-6-6-6" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </div>
    </button>
  );
}

interface ScanDiffPanelProps {
  diff: ScanDiff;
  onClose: () => void;
  relativeTime: (date: string) => string;
}

function ScanDiffPanel({ diff, onClose, relativeTime }: ScanDiffPanelProps) {
  const statusColors: Record<string, string> = {
    improved: "text-success",
    worsened: "text-danger",
    unchanged: "text-text-quaternary",
    added: "text-accent",
    removed: "text-warning",
  };

  return (
    <div className="rounded-xl border border-border-default bg-surface-1 overflow-hidden animate-fade-in-up">
      <div className="px-5 py-3 border-b border-border-subtle bg-surface-2/50 flex items-center justify-between">
        <h3 className="text-xs font-semibold text-text-tertiary uppercase tracking-wider">
          Diff: {relativeTime(diff.scanA.startedAt)} → {relativeTime(diff.scanB.startedAt)}
        </h3>
        <button 
          onClick={onClose} 
          className="text-text-quaternary hover:text-text-secondary transition-colors rounded p-1"
          aria-label="Close diff"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round"/>
          </svg>
        </button>
      </div>

      {/* Summary */}
      <div className="px-5 py-3 border-b border-border-subtle flex flex-wrap items-center gap-4 text-sm">
        <SummaryBadge label="Improved" count={diff.summary.improved} color="success" />
        <SummaryBadge label="Worsened" count={diff.summary.worsened} color="danger" />
        <SummaryBadge label="Unchanged" count={diff.summary.unchanged} color="muted" />
        {diff.summary.added > 0 && (
          <SummaryBadge label="Added" count={diff.summary.added} color="accent" />
        )}
        {diff.summary.removed > 0 && (
          <SummaryBadge label="Removed" count={diff.summary.removed} color="warning" />
        )}
      </div>

      {/* Diff Table */}
      <div className="max-h-96 overflow-y-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-surface-1">
            <tr className="border-b border-border-subtle">
              <th className="py-2.5 px-5 text-left text-xs font-semibold text-text-quaternary uppercase tracking-wider">Repo</th>
              <th className="py-2.5 px-4 text-center text-xs font-semibold text-text-quaternary uppercase tracking-wider w-20">Before</th>
              <th className="py-2.5 px-4 text-center text-xs font-semibold text-text-quaternary uppercase tracking-wider w-20">After</th>
              <th className="py-2.5 px-4 text-center text-xs font-semibold text-text-quaternary uppercase tracking-wider w-20">Delta</th>
              <th className="py-2.5 px-4 text-center text-xs font-semibold text-text-quaternary uppercase tracking-wider w-24">Status</th>
            </tr>
          </thead>
          <tbody>
            {diff.diff.slice(0, 100).map((d) => (
              <tr key={d.repoName} className="border-b border-border-subtle last:border-b-0 hover:bg-surface-2/50">
                <td className="py-2.5 px-5 text-text-secondary font-medium">{d.repoName}</td>
                <td className="py-2.5 px-4 text-center font-mono text-text-tertiary">
                  {d.scoreA ?? "—"}
                </td>
                <td className="py-2.5 px-4 text-center font-mono text-text-tertiary">
                  {d.scoreB ?? "—"}
                </td>
                <td className={`py-2.5 px-4 text-center font-mono font-bold ${
                  d.delta > 0 ? "text-danger" : d.delta < 0 ? "text-success" : "text-text-quaternary"
                }`}>
                  {d.delta > 0 ? `+${d.delta}` : d.delta === 0 ? "—" : d.delta}
                </td>
                <td className={`py-2.5 px-4 text-center capitalize text-xs font-medium ${statusColors[d.status] ?? "text-text-quaternary"}`}>
                  {d.status}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SummaryBadge({ label, count, color }: { label: string; count: number; color: "success" | "danger" | "warning" | "accent" | "muted" }) {
  const colorClasses = {
    success: "text-success",
    danger: "text-danger",
    warning: "text-warning",
    accent: "text-accent",
    muted: "text-text-quaternary",
  };

  return (
    <div className="flex items-center gap-1.5">
      <span className={`font-mono font-bold ${colorClasses[color]}`}>{count}</span>
      <span className="text-text-tertiary">{label}</span>
    </div>
  );
}

function formatDuration(start: Date, end: Date): string {
  const seconds = Math.floor((end.getTime() - start.getTime()) / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}m ${remainingSeconds}s`;
}
