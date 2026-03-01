"use client";

import { useState, useEffect } from "react";
import type { QualityGateStatus, ScanStatusInfo } from "./types";

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
  onCancelScan?: () => void;
  isScanning?: boolean;
  resultsLoading?: boolean;
  scanProgress?: ScanStatusInfo | null;
  metrics?: {
    severeCount: number;
    highCount: number;
    totalRepos: number;
    avgScore: number;
  };
}

export function QualityGateCard({ status, reason, onStartScan, onCancelScan, isScanning, resultsLoading, scanProgress, metrics }: QualityGateCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [elapsed, setElapsed] = useState(0);

  // Update elapsed time every second while scanning
  useEffect(() => {
    if (!isScanning || !scanProgress?.startedAt) {
      setElapsed(0);
      return;
    }
    
    const updateElapsed = () => {
      const start = new Date(scanProgress.startedAt).getTime();
      setElapsed(Math.max(0, Math.floor((Date.now() - start) / 1000)));
    };
    
    updateElapsed();
    const interval = setInterval(updateElapsed, 1000);
    return () => clearInterval(interval);
  }, [isScanning, scanProgress?.startedAt]);

  const handleScanClick = () => {
    if (isScanning) return;
    setShowConfirm(true);
  };

  const handleConfirmScan = () => {
    setShowConfirm(false);
    onStartScan?.();
  };

  // Confirmation Modal - shared between states
  const confirmModal = showConfirm && (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in"
      onClick={() => setShowConfirm(false)}
    >
      <div 
        className="w-full max-w-sm rounded-xl border border-border-default bg-surface-1 shadow-xl animate-fade-in-up"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-5 space-y-4">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-full bg-accent-subtle text-accent">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 12a9 9 0 11-9-9c2.52 0 4.93 1 6.74 2.74L21 8" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M21 3v5h-5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <div>
              <h3 className="text-base font-semibold text-text-primary">Start Scan?</h3>
              <p className="text-sm text-text-secondary">This will analyze all repositories in the organization.</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3 px-5 py-4 border-t border-border-default bg-surface-2 rounded-b-xl">
          <button
            onClick={() => setShowConfirm(false)}
            className="flex-1 px-4 py-2 rounded-lg text-sm font-medium text-text-secondary border border-border-default bg-surface-1 hover:bg-surface-3 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirmScan}
            className="flex-1 px-4 py-2 rounded-lg text-sm font-medium text-white bg-accent hover:bg-accent-hover transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
          >
            Start Scan
          </button>
        </div>
      </div>
    </div>
  );

  // Format elapsed time
  const formatElapsed = (secs: number) => {
    if (secs < 60) return `${secs}s`;
    const mins = Math.floor(secs / 60);
    const remainingSecs = secs % 60;
    return `${mins}m ${remainingSecs}s`;
  };

  // Starting scan state - isScanning but no progress yet
  if (isScanning && !scanProgress) {
    return (
      <div className="rounded-xl border border-accent/30 bg-accent-subtle overflow-hidden">
        <div className="p-5">
          <div className="flex items-center gap-3">
            <div className="relative flex items-center justify-center w-10 h-10 rounded-full bg-accent/20">
              <svg className="animate-spin h-5 w-5 text-accent" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-semibold text-text-primary">Starting scan...</h3>
              <p className="text-xs text-text-secondary">Preparing to analyze repositories</p>
            </div>
            {onCancelScan && (
              <button
                onClick={onCancelScan}
                className="px-3 py-1.5 text-xs font-medium text-text-secondary hover:text-text-primary border border-border-default rounded-lg hover:bg-surface-2 transition-colors"
              >
                Cancel
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Scanning state - show progress instead of "Ready to scan"
  if (isScanning && scanProgress) {
    const total = scanProgress.totalRepoCount;
    const processed = scanProgress.processedRepoCount;
    const pct = total > 0 ? Math.round((processed / total) * 100) : 0;

    return (
      <>
        <div className="rounded-xl border border-accent/30 bg-accent-subtle overflow-hidden">
          <div className="p-5 space-y-4">
            {/* Header */}
            <div className="flex items-center gap-3">
              <div className="relative flex items-center justify-center w-10 h-10 rounded-full bg-accent/20">
                <svg className="animate-spin h-5 w-5 text-accent" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-semibold text-text-primary">Scanning repositories...</h3>
                <p className="text-xs text-text-secondary">Analyzing code health across your organization</p>
              </div>
              <div className="flex items-center gap-3">
                {elapsed > 0 && (
                  <span className="text-xs text-text-tertiary font-mono">{formatElapsed(elapsed)}</span>
                )}
                {onCancelScan && (
                  <button
                    onClick={onCancelScan}
                    className="px-3 py-1.5 text-xs font-medium text-text-secondary hover:text-text-primary border border-border-default rounded-lg hover:bg-surface-2 transition-colors"
                  >
                    Cancel
                  </button>
                )}
              </div>
            </div>

            {/* Progress bar */}
            {total > 0 && (
              <div className="space-y-2">
                <div className="h-2 rounded-full bg-surface-1 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-accent transition-all duration-500 ease-out"
                    style={{ width: `${Math.max(pct, 2)}%` }}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-text-secondary">
                    <span className="font-mono font-semibold text-text-primary">{processed}</span>
                    <span className="text-text-tertiary"> of </span>
                    <span className="font-mono">{total}</span>
                    <span className="text-text-tertiary"> repos</span>
                  </span>
                  <span className="text-sm font-mono font-semibold text-accent">{pct}%</span>
                </div>
              </div>
            )}
          </div>
        </div>
        {confirmModal}
      </>
    );
  }

  // Loading results state - show while fetching results after scan completes
  if (resultsLoading && status === "unknown") {
    return (
      <div className="rounded-xl border border-accent/30 bg-accent-subtle overflow-hidden">
        <div className="p-5">
          <div className="flex items-center gap-3">
            <div className="relative flex items-center justify-center w-10 h-10 rounded-full bg-accent/20">
              <svg className="animate-spin h-5 w-5 text-accent" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-semibold text-text-primary">Loading results...</h3>
              <p className="text-xs text-text-secondary">Preparing your scan data</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (status === "unknown") {
    return (
      <>
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
              onClick={handleScanClick}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-accent text-white text-on-color font-medium text-sm transition-all hover:bg-accent-hover active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path d="M21 12a9 9 0 11-9-9c2.52 0 4.93 1 6.74 2.74L21 8" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M21 3v5h-5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Start Scan
            </button>
          )}
        </div>
        {confirmModal}
      </>
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
    <>
      <div 
        className={`
          rounded-xl border transition-all
          ${isPassing 
            ? "border-success/30 bg-success-subtle" 
            : "border-danger/30 bg-danger-subtle"
          }
        `}
        role="region"
        aria-label="Quality gate status"
      >
        {/* Header row - always visible */}
        {/* On mobile: entire row is clickable for expand. On desktop: only details button */}
        <div 
          className={`flex items-center justify-between gap-3 p-4 ${gates ? "sm:cursor-default cursor-pointer" : ""}`}
          onClick={() => {
            // Only toggle on mobile (when gates exist)
            if (gates && window.innerWidth < 640) {
              setExpanded(!expanded);
            }
          }}
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className={`
              flex items-center justify-center w-8 h-8 rounded-full shrink-0
              ${isPassing ? "bg-success/20 text-success" : "bg-danger/20 text-danger"}
            `}>
              {isPassing ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
                  <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
                  <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.072 16.5c-.77.833.192 2.5 1.732 2.5z" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-text-primary">
                  Quality Gate {isPassing ? "Passed" : "Failed"}
                </h3>
                {/* Mobile chevron indicator */}
                {gates && (
                  <svg 
                    width="14" 
                    height="14" 
                    viewBox="0 0 24 24" 
                    fill="none" 
                    stroke="currentColor" 
                    strokeWidth="2"
                    className={`sm:hidden text-text-tertiary transition-transform ${expanded ? "rotate-180" : ""}`}
                  >
                    <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                )}
              </div>
              <p className="text-xs text-text-secondary">{reason}</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
            {/* Desktop expand/collapse button */}
            {gates && (
              <button
                onClick={() => setExpanded(!expanded)}
                className="hidden sm:flex items-center gap-1 px-2 py-1 rounded-lg text-xs text-text-tertiary hover:text-text-secondary hover:bg-surface-1/50 transition-colors"
                aria-expanded={expanded}
                aria-label={expanded ? "Hide details" : "Show details"}
              >
                <span>{expanded ? "Hide" : "Details"}</span>
                <svg 
                  width="14" 
                  height="14" 
                  viewBox="0 0 24 24" 
                  fill="none" 
                  stroke="currentColor" 
                  strokeWidth="2"
                  className={`transition-transform ${expanded ? "rotate-180" : ""}`}
                >
                  <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
            )}

            {onStartScan && (
              <button
                onClick={handleScanClick}
                disabled={isScanning}
                aria-label={isScanning ? "Scanning" : isPassing ? "Re-scan" : "Fix and scan"}
                className={`shrink-0 inline-flex items-center justify-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98] ${
                  isPassing
                    ? "border border-border-default bg-surface-1 text-text-secondary hover:bg-surface-2 hover:text-text-primary focus-visible:ring-accent/50"
                    : "bg-danger text-white hover:brightness-110 focus-visible:ring-danger/50"
                }`}
              >
                {isScanning ? (
                  <>
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                    </svg>
                    <span className="hidden sm:inline">Scanning...</span>
                  </>
                ) : (
                  <>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                      <path d="M21 12a9 9 0 11-9-9c2.52 0 4.93 1 6.74 2.74L21 8" strokeLinecap="round" strokeLinejoin="round"/>
                      <path d="M21 3v5h-5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    <span className="hidden sm:inline">{isPassing ? "Re-scan" : "Fix & Scan"}</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>

        {/* Collapsible criteria section */}
        {gates && expanded && (
          <div className="px-4 pb-4 pt-0 border-t border-border-subtle animate-fade-in">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-4">
              {gates.map((gate) => (
                <div 
                  key={gate.label}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border ${
                    gate.passing 
                      ? "bg-surface-1 border-success/20" 
                      : "bg-surface-1 border-danger/20"
                  }`}
                >
                  {gate.passing ? (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-success shrink-0" aria-hidden="true">
                      <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  ) : (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-danger shrink-0" aria-hidden="true">
                      <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-text-secondary">{gate.label}</p>
                    <p className={`text-sm font-semibold ${gate.passing ? "text-success" : "text-danger"}`}>
                      {gate.value}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {confirmModal}
    </>
  );
}
