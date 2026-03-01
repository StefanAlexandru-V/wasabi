"use client";

import { useState } from "react";
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

const labels: Record<string, string> = {
  inactivity: "Inactivity (>6 months)",
  criticalVulnerabilities: "Critical Vulnerabilities",
  missingCodeowners: "Missing CODEOWNERS",
  noBranchProtection: "No Branch Protection",
  stalePRs: "Stale PRs (>5 open >30 days)",
  noCI: "No CI Workflows",
  notArchivedButInactive: "Not Archived but Inactive",
};

const icons: Record<string, string> = {
  inactivity: "M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z",
  criticalVulnerabilities: "M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.072 16.5c-.77.833.192 2.5 1.732 2.5z",
  missingCodeowners: "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z",
  noBranchProtection: "M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z",
  stalePRs: "M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4",
  noCI: "M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15",
  notArchivedButInactive: "M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4",
};

function severityGlow(severity: string) {
  if (severity === "severe") return "glow-danger";
  if (severity === "high") return "";
  return "glow-success";
}

export function ScorePanel({
  result,
  onClose,
  orgName,
}: {
  result: ScanResult;
  onClose: () => void;
  orgName?: string;
}) {
  const [copied, setCopied] = useState(false);
  const maxScore = 17;
  const pct = Math.min((result.rotScore / maxScore) * 100, 100);
  const githubUrl = orgName ? `https://github.com/${orgName}/${result.repoName}` : null;

  async function copyBreakdown() {
    try {
      const json = JSON.stringify({
        repoName: result.repoName,
        rotScore: result.rotScore,
        severity: result.severity,
        scoreBreakdown: result.scoreBreakdown,
        lastCommit: result.lastCommit,
        archived: result.archived,
      }, null, 2);
      await navigator.clipboard.writeText(json);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  }

  return (
    <div className={`w-full lg:w-96 shrink-0 animate-slide-in-right rounded-xl border border-border-default bg-surface-1 overflow-hidden h-fit ${severityGlow(result.severity)}`} role="complementary" aria-label={`Score details for ${result.repoName}`}>
      <div className="p-5 space-y-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="font-semibold text-base sm:text-lg truncate">{result.repoName}</h3>
            <div className="flex items-center gap-2 mt-1">
              <span
                className={`text-[11px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-md border ${
                  result.severity === "severe"
                    ? "bg-danger-subtle text-danger border-danger/20"
                    : result.severity === "high"
                    ? "bg-severe-subtle text-severe border-severe/20"
                    : "bg-success-subtle text-success border-success/20"
                }`}
              >
                {result.severity}
              </span>
              {result.archived && (
                <span className="text-xs px-1.5 py-0.5 rounded bg-surface-3 text-text-quaternary font-medium">ARCHIVED</span>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-text-quaternary hover:text-text-secondary transition-colors rounded-lg p-1 hover:bg-surface-3 shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
            aria-label="Close details panel"
          >
            &times;
          </button>
        </div>

        <div className="flex items-center gap-4">
          <div className="relative">
            <svg className="w-16 h-16 -rotate-90" viewBox="0 0 36 36" aria-hidden="true">
              <circle
                cx="18" cy="18" r="14"
                fill="none"
                stroke="currentColor"
                strokeWidth="3"
                className="text-surface-3"
              />
              <circle
                cx="18" cy="18" r="14"
                fill="none"
                strokeWidth="3"
                strokeLinecap="round"
                strokeDasharray={`${pct * 0.88} 100`}
                className={
                  result.severity === "severe"
                    ? "text-danger"
                    : result.severity === "high"
                    ? "text-severe"
                    : "text-success"
                }
                stroke="currentColor"
              />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-lg font-bold font-mono" aria-label={`Score: ${result.rotScore}`}>
              {result.rotScore}
            </span>
          </div>
          <div className="text-sm text-text-tertiary space-y-1">
            <div>
              <span className="text-text-quaternary">Max possible:</span>{" "}
              <span className="font-mono">{maxScore}</span>
            </div>
            <div>
              <span className="text-text-quaternary">Percentile:</span>{" "}
              <span className="font-mono">{Math.round(pct)}%</span>
            </div>
          </div>
        </div>

        <div className="space-y-1">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-xs font-semibold text-text-quaternary uppercase tracking-wider">Score Breakdown</h4>
            <button
              onClick={copyBreakdown}
              className="inline-flex items-center gap-1 text-xs text-text-quaternary hover:text-text-secondary transition-colors px-1.5 py-0.5 rounded hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
              aria-label="Copy score breakdown as JSON"
              title="Copy as JSON"
            >
              {copied ? (
                <>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                    <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  Copied
                </>
              ) : (
                <>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  JSON
                </>
              )}
            </button>
          </div>
          {Object.entries(result.scoreBreakdown).map(([key, value]) => (
            <div
              key={key}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
                value > 0 ? "bg-surface-2" : ""
              }`}
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className={value > 0 ? "text-danger shrink-0" : "text-text-quaternary shrink-0"}
                aria-hidden="true"
              >
                <path d={icons[key] ?? "M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"} />
              </svg>
              <span className={`flex-1 text-sm ${value > 0 ? "text-text-primary" : "text-text-quaternary"}`}>
                {labels[key] ?? key}
              </span>
              <span
                className={`font-mono text-sm font-semibold tabular-nums ${
                  value > 0 ? "text-danger" : "text-text-quaternary"
                }`}
              >
                +{value}
              </span>
            </div>
          ))}
        </div>

        <div className="text-sm space-y-2 pt-3 border-t border-border-subtle">
          <div className="flex items-center justify-between">
            <span className="text-text-quaternary">Last commit:</span>
            <span
              className="text-text-tertiary font-mono"
              title={result.lastCommit ? new Date(result.lastCommit).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }) : undefined}
            >
              {result.lastCommit
                ? relativeTime(result.lastCommit)
                : "N/A"}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-text-quaternary">Archived:</span>
            <span className="text-text-tertiary">{result.archived ? "Yes" : "No"}</span>
          </div>
          {githubUrl && (
            <a
              href={githubUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 mt-1 text-accent hover:text-accent-hover transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 rounded"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
              </svg>
              View on GitHub
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
