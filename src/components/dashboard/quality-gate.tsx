"use client";

import type { QualityGateStatus } from "./types";

interface QualityGateBadgeProps {
  status: QualityGateStatus;
  reason: string;
}

export function QualityGateBadge({ status, reason }: QualityGateBadgeProps) {
  if (status === "unknown") {
    return (
      <div 
        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border-default bg-surface-2 text-text-tertiary"
        role="status"
        aria-label="Quality gate status unknown"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <circle cx="12" cy="12" r="10"/>
          <path d="M12 16v-4M12 8h.01" strokeLinecap="round"/>
        </svg>
        <span className="text-sm font-medium">No Data</span>
      </div>
    );
  }

  const isPassing = status === "pass";

  return (
    <div 
      className={`
        inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-all
        ${isPassing 
          ? "border-success/30 bg-success-subtle text-success glow-success" 
          : "border-danger/30 bg-danger-subtle text-danger glow-danger"
        }
      `}
      role="status"
      aria-label={`Quality gate ${isPassing ? "passing" : "failing"}: ${reason}`}
      title={reason}
    >
      {isPassing ? (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
          <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      ) : (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
          <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      )}
      <span className="text-sm font-semibold">{isPassing ? "Passing" : "Failing"}</span>
      <span className="hidden sm:inline text-xs opacity-80">— {reason}</span>
    </div>
  );
}

interface QualityGateCardProps {
  status: QualityGateStatus;
  reason: string;
  onStartScan?: () => void;
  isScanning?: boolean;
  metrics?: {
    severeCount: number;
    highCount: number;
    totalRepos: number;
    avgScore: number;
  };
}

export function QualityGateCard({ status, reason, onStartScan, isScanning, metrics }: QualityGateCardProps) {
  if (status === "unknown") {
    return (
      <div className="rounded-xl border border-border-default bg-surface-1 p-6 text-center space-y-4">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-surface-3 text-wasabi">
          <svg width="24" height="24" viewBox="0 0 32 32" fill="none" aria-hidden="true">
            <path d="M16 4c-5 5-9 10-9 16a9 9 0 0018 0c0-6-4-11-9-16z" fill="currentColor" opacity="0.85"/>
            <path d="M16 8v14M13 13l3-2 3 2M13 17.5l3-1.5 3 1.5" stroke="currentColor" strokeWidth="1" strokeLinecap="round" opacity="0.35"/>
          </svg>
        </div>
        <div className="space-y-1">
          <h3 className="text-lg font-semibold text-text-primary">Ready to scan</h3>
          <p className="text-sm text-text-tertiary">
            Run your first scan to check organization health
          </p>
        </div>
        {onStartScan && (
          <button
            onClick={onStartScan}
            disabled={isScanning}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-accent text-white text-on-color font-medium text-sm transition-all hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
          >
            {isScanning ? (
              <>
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                </svg>
                Scanning...
              </>
            ) : (
              <>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <path d="M21 12a9 9 0 11-9-9c2.52 0 4.93 1 6.74 2.74L21 8" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M21 3v5h-5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                Start Scan
              </>
            )}
          </button>
        )}
      </div>
    );
  }

  const isPassing = status === "pass";

  // Compute individual gate statuses
  const gates = metrics ? [
    {
      label: "No severe repos",
      description: "Repos with score ≥10",
      passing: metrics.severeCount === 0,
      value: metrics.severeCount === 0 ? "0" : `${metrics.severeCount} found`,
    },
    {
      label: "High-risk repos ≤20%",
      description: "Repos with score 7-9",
      passing: metrics.highCount <= metrics.totalRepos * 0.2,
      value: metrics.totalRepos > 0 
        ? `${Math.round((metrics.highCount / metrics.totalRepos) * 100)}%` 
        : "0%",
    },
    {
      label: "Average score ≤6",
      description: "Across all repos",
      passing: metrics.avgScore <= 6,
      value: metrics.avgScore.toFixed(1),
    },
  ] : null;

  return (
    <div 
      className={`
        rounded-xl border p-5 transition-all
        ${isPassing 
          ? "border-success/30 bg-success-subtle" 
          : "border-danger/30 bg-danger-subtle"
        }
      `}
      role="region"
      aria-label="Quality gate status"
    >
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className={`
            flex items-center justify-center w-10 h-10 rounded-full shrink-0
            ${isPassing ? "bg-success/20 text-success" : "bg-danger/20 text-danger"}
          `}>
            {isPassing ? (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
                <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
                <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.072 16.5c-.77.833.192 2.5 1.732 2.5z" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            )}
          </div>
          <div className="space-y-0.5">
            <h3 className={`text-lg font-semibold text-text-primary`}>
              Quality Gate {isPassing ? "Passed" : "Failed"}
            </h3>
            <p className="text-sm text-text-secondary">{reason}</p>
          </div>
        </div>
        {onStartScan && (
          <button
            onClick={onStartScan}
            disabled={isScanning}
            className={`w-full sm:w-auto shrink-0 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98] ${
              isPassing
                ? "border border-border-default bg-surface-2 text-text-secondary hover:bg-surface-3 hover:text-text-primary focus-visible:ring-accent/50"
                : "bg-danger text-white hover:brightness-110 focus-visible:ring-danger/50"
            }`}
          >
            {isScanning ? (
              <>
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                </svg>
                Scanning...
              </>
            ) : (
              <>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <path d="M21 12a9 9 0 11-9-9c2.52 0 4.93 1 6.74 2.74L21 8" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M21 3v5h-5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                {isPassing ? "Re-scan" : "Fix & Re-scan"}
              </>
            )}
          </button>
        )}
      </div>

      {/* Quality Gate Criteria */}
      {gates && (
        <div className="mt-5 pt-5 border-t border-border-subtle">
          <div className="flex flex-col gap-3">
            {gates.map((gate) => (
              <div 
                key={gate.label}
                className={`flex items-center gap-3 px-4 py-3.5 rounded-xl border ${
                  gate.passing 
                    ? "bg-success-subtle border-success/20" 
                    : "bg-danger-subtle border-danger/20"
                }`}
              >
                {gate.passing ? (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-success shrink-0" aria-hidden="true">
                    <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                ) : (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-danger shrink-0" aria-hidden="true">
                    <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-text-primary">
                    {gate.label}
                  </p>
                  <p className="text-sm text-text-tertiary mt-0.5">
                    Current: <span className={`font-mono font-semibold ${gate.passing ? "text-success" : "text-danger"}`}>{gate.value}</span>
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
