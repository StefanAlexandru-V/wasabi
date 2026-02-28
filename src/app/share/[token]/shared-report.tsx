"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { relativeTime } from "@/lib/relative-time";

interface ScanResult {
  rank: number;
  repoName: string;
  rotScore: number;
  severity: string;
  lastCommit: string | null;
  scoreBreakdown: Record<string, number>;
  archived: boolean;
}

interface SharedData {
  orgName: string;
  scan: {
    id: string;
    status: string;
    startedAt: string;
    completedAt: string | null;
    repoCount: number;
  };
  results: ScanResult[];
}

function severityBadge(severity: string) {
  const styles: Record<string, string> = {
    severe: "bg-danger-subtle text-danger border-danger/20",
    high: "bg-severe-subtle text-severe border-severe/20",
    low: "bg-success-subtle text-success border-success/20",
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold uppercase tracking-wider border ${styles[severity] ?? styles.low}`}>
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

export function SharedReport({ token }: { token: string }) {
  const [data, setData] = useState<SharedData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/share/${token}`)
      .then((r) => {
        if (!r.ok) throw new Error(r.status === 404 ? "Report not found or link has expired." : "Failed to load report.");
        return r.json();
      })
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [token]);

  const stats = useMemo(() => {
    if (!data) return null;
    const results = data.results;
    const severeCount = results.filter((r) => r.severity === "severe").length;
    const highCount = results.filter((r) => r.severity === "high").length;
    const avgScore = results.length ? Math.round(results.reduce((s, r) => s + r.rotScore, 0) / results.length) : 0;
    return { severeCount, highCount, avgScore };
  }, [data]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-0">
        <div className="animate-pulse text-text-tertiary text-sm">Loading report...</div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-0 p-8">
        <div className="text-center space-y-4 animate-fade-in-up">
          <div className="flex items-center justify-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-danger-subtle border border-danger/20">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-danger">
                <circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>
              </svg>
            </div>
          </div>
          <h1 className="text-lg font-semibold text-text-primary">{error ?? "Report not found"}</h1>
          <p className="text-text-tertiary text-sm">This shared report link may have expired or been revoked.</p>
          <Link href="/" className="inline-flex items-center gap-2 text-accent hover:text-accent-hover text-sm font-medium transition-colors">
            Go to Wasabi
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface-0 animate-fade-in">
      <header className="border-b border-border-default bg-surface-0/80 backdrop-blur-xl">
        <div className="mx-auto max-w-7xl flex items-center justify-between px-4 sm:px-6 h-14">
          <div className="flex items-center gap-3">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-surface-2 border border-border-default">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="7" stroke="#b45309" strokeWidth="1.5" strokeDasharray="3 1.5" opacity="0.8"/>
                <path d="M9 9l1.5 1.5M15 9l-1.5 1.5M9 15l1.5-1.5M15 15l-1.5-1.5" stroke="#d97706" strokeWidth="1.2" strokeLinecap="round" opacity="0.6"/>
                <circle cx="12" cy="12" r="1.5" fill="#f59e0b"/>
              </svg>
            </div>
            <h1 className="text-sm font-semibold tracking-tight">Wasabi</h1>
            <span className="text-xs px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-500 border border-amber-500/20 font-medium">Shared Report</span>
          </div>
          <div className="text-xs text-text-tertiary">
            {data.orgName} &middot; {data.scan.repoCount} repos &middot; {data.scan.completedAt ? relativeTime(data.scan.completedAt) : "N/A"}
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-6 space-y-6">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 animate-fade-in-up">
          <div className="rounded-xl border border-border-default bg-surface-1 p-4 space-y-1">
            <p className="text-xs font-medium text-text-tertiary uppercase tracking-wider">Repos</p>
            <p className="text-2xl font-bold font-mono">{data.results.length}</p>
          </div>
          <div className="rounded-xl border border-border-default bg-surface-1 p-4 space-y-1">
            <p className="text-xs font-medium text-text-tertiary uppercase tracking-wider">Avg Score</p>
            <p className="text-2xl font-bold font-mono">{stats?.avgScore}</p>
          </div>
          <div className="rounded-xl border border-danger/20 bg-danger-subtle p-4 space-y-1">
            <p className="text-xs font-medium text-danger/80 uppercase tracking-wider">Severe</p>
            <p className="text-2xl font-bold font-mono text-danger">{stats?.severeCount}</p>
          </div>
          <div className="rounded-xl border border-severe/20 bg-severe-subtle p-4 space-y-1">
            <p className="text-xs font-medium text-severe/80 uppercase tracking-wider">High</p>
            <p className="text-2xl font-bold font-mono text-severe">{stats?.highCount}</p>
          </div>
        </div>

        <div className="overflow-x-auto rounded-xl border border-border-default bg-surface-1">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border-default">
                <th className="py-3 px-4 text-left text-[11px] font-semibold text-text-quaternary uppercase tracking-wider w-12">#</th>
                <th className="py-3 px-4 text-left text-[11px] font-semibold text-text-quaternary uppercase tracking-wider">Repo</th>
                <th className="py-3 px-4 text-left text-[11px] font-semibold text-text-quaternary uppercase tracking-wider w-24">Score</th>
                <th className="py-3 px-4 text-left text-[11px] font-semibold text-text-quaternary uppercase tracking-wider w-24">Severity</th>
                <th className="py-3 px-4 text-left text-[11px] font-semibold text-text-quaternary uppercase tracking-wider w-32">Last Commit</th>
              </tr>
            </thead>
            <tbody>
              {data.results.map((r) => (
                <tr key={r.repoName} className="border-b border-border-subtle last:border-b-0 hover:bg-surface-2 transition-colors">
                  <td className="py-3 px-4 font-mono text-xs text-text-quaternary">{r.rank}</td>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{r.repoName}</span>
                      {r.archived && <span className="text-[10px] px-1.5 py-0.5 rounded bg-surface-3 text-text-quaternary font-medium">ARCHIVED</span>}
                    </div>
                  </td>
                  <td className={`py-3 px-4 font-mono font-semibold ${scoreColor(r.rotScore)}`}>{r.rotScore}</td>
                  <td className="py-3 px-4">{severityBadge(r.severity)}</td>
                  <td className="py-3 px-4 text-text-tertiary text-xs font-mono">{r.lastCommit ? relativeTime(r.lastCommit) : "N/A"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="text-center text-xs text-text-quaternary py-4">
          Generated by <Link href="/" className="text-accent hover:text-accent-hover transition-colors">Wasabi</Link>
        </div>
      </div>
    </div>
  );
}
