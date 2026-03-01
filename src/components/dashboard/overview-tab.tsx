"use client";

import { QualityGateCard } from "./quality-gate";
import { computeQualityGate, factorLabels } from "./types";
import type { ScanResult, OrgStats, ScanStatusInfo } from "./types";
import { OrgStatsSkeleton } from "../skeletons";

interface OverviewTabProps {
  results: ScanResult[];
  orgStats: OrgStats | null;
  orgStatsLoading: boolean;
  lastScanTime: string | null;
  scanStatusInfo: ScanStatusInfo | null;
  isScanning: boolean;
  onStartScan?: () => void;
  relativeTime: (date: string) => string;
}

export function OverviewTab({
  results,
  orgStats,
  orgStatsLoading,
  lastScanTime,
  scanStatusInfo,
  isScanning,
  onStartScan,
  relativeTime,
}: OverviewTabProps) {
  const qualityGate = computeQualityGate(results);
  
  const avgScoreNum = results.length > 0 
    ? results.reduce((sum, r) => sum + r.rotScore, 0) / results.length
    : 0;
  const avgScore = results.length > 0 ? avgScoreNum.toFixed(1) : "—";
  const severeCount = results.filter(r => r.severity === "severe").length;
  const highCount = results.filter(r => r.severity === "high").length;
  const lowCount = results.filter(r => r.severity === "low").length;

  const qualityGateMetrics = results.length > 0 ? {
    severeCount,
    highCount,
    totalRepos: results.length,
    avgScore: avgScoreNum,
  } : undefined;

  return (
    <div className="space-y-6">
      {/* Quality Gate */}
      <QualityGateCard 
        status={qualityGate.status} 
        reason={qualityGate.reason}
        onStartScan={onStartScan}
        isScanning={isScanning}
        metrics={qualityGateMetrics}
      />

      {/* Scan Progress */}
      {isScanning && scanStatusInfo && (
        <ScanProgressCard statusInfo={scanStatusInfo} />
      )}

      {/* KPI Cards */}
      {results.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <KPICard 
            label="Total Repos" 
            value={results.length} 
            icon={
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
                <path d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            }
          />
          <KPICard 
            label="Avg Score" 
            value={avgScore}
            subtitle="/ 17 max"
            icon={
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
                <path d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            }
          />
          <KPICard 
            label="Severe" 
            value={severeCount}
            variant="danger"
            icon={
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
                <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.072 16.5c-.77.833.192 2.5 1.732 2.5z" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            }
          />
          <KPICard 
            label="High Risk" 
            value={highCount}
            variant="severe"
            icon={
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
                <path d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            }
          />
        </div>
      )}

      {/* Org Health Overview */}
      {orgStatsLoading ? (
        <OrgStatsSkeleton />
      ) : orgStats && orgStats.totalRepos > 0 ? (
        <OrgHealthPanel stats={orgStats} />
      ) : null}

      {/* Last Scan Info */}
      {lastScanTime && (
        <div className="flex items-center gap-2 text-xs text-text-quaternary">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2" strokeLinecap="round"/>
          </svg>
          <span>Last scanned {relativeTime(lastScanTime)}</span>
        </div>
      )}

      {/* Severity Breakdown */}
      {results.length > 0 && (
        <SeverityBreakdown 
          severe={severeCount} 
          high={highCount} 
          low={lowCount} 
          total={results.length} 
        />
      )}
    </div>
  );
}

// Sub-components

interface KPICardProps {
  label: string;
  value: string | number;
  subtitle?: string;
  variant?: "default" | "danger" | "severe" | "success";
  icon?: React.ReactNode;
}

function KPICard({ label, value, subtitle, variant = "default", icon }: KPICardProps) {
  const variants = {
    default: "border-border-default bg-surface-1",
    danger: "border-danger/30 bg-danger-subtle",
    severe: "border-severe/30 bg-severe-subtle",
    success: "border-success/30 bg-success-subtle",
  };

  const textVariants = {
    default: "text-text-primary",
    danger: "text-danger",
    severe: "text-severe",
    success: "text-success",
  };

  const iconVariants = {
    default: "text-text-tertiary",
    danger: "text-danger",
    severe: "text-severe",
    success: "text-success",
  };

  return (
    <div className={`rounded-xl border p-4 space-y-2 ${variants[variant]}`}>
      <div className="flex items-center gap-2">
        {icon && <span className={iconVariants[variant]}>{icon}</span>}
        <p className="text-xs font-medium uppercase tracking-wider text-text-tertiary">
          {label}
        </p>
      </div>
      <div className="flex items-baseline gap-1">
        <p className={`text-2xl font-bold font-mono ${textVariants[variant]}`}>{value}</p>
        {subtitle && <span className="text-xs text-text-quaternary">{subtitle}</span>}
      </div>
    </div>
  );
}

interface OrgHealthPanelProps {
  stats: OrgStats;
}

function OrgHealthPanel({ stats }: OrgHealthPanelProps) {
  const maxFactorCount = stats.topRotFactors[0]?.count ?? 1;

  return (
    <div className="rounded-xl border border-border-default bg-surface-1 overflow-hidden" role="region" aria-label="Organization Health Overview">
      <div className="px-5 py-3 border-b border-border-subtle bg-surface-2/50">
        <h3 className="text-xs font-semibold text-text-tertiary uppercase tracking-wider">Org Health Overview</h3>
      </div>
      
      <div className="p-5 space-y-5">
        {/* Quick Stats Row */}
        <div className="grid grid-cols-3 gap-4">
          <div>
            <p className="text-xs text-text-tertiary mb-0.5">Severe %</p>
            <p className="text-xl font-bold font-mono text-text-primary">{stats.severePct}%</p>
          </div>
          <div>
            <p className="text-xs text-text-tertiary mb-0.5">Avg Score</p>
            <p className="text-xl font-bold font-mono text-text-primary">{stats.avgScore}</p>
          </div>
          <div>
            <p className="text-xs text-text-tertiary mb-0.5">Total Scans</p>
            <p className="text-xl font-bold font-mono text-text-primary">{stats.totalScans}</p>
          </div>
        </div>

        {/* Top Rot Factors */}
        {stats.topRotFactors.length > 0 && (
          <div className="space-y-3 pt-4 border-t border-border-subtle">
            <h4 className="text-xs font-semibold text-text-tertiary uppercase tracking-wider">Top Rot Factors</h4>
            <div className="space-y-2">
              {stats.topRotFactors.map((f) => (
                <div key={f.factor} className="flex items-center gap-3">
                  <span className="text-sm text-text-secondary w-32 truncate" title={factorLabels[f.factor] ?? f.factor}>
                    {factorLabels[f.factor] ?? f.factor}
                  </span>
                  <div className="flex-1 h-2.5 rounded-full bg-surface-3 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-danger transition-all duration-500"
                      style={{ width: `${(f.count / maxFactorCount) * 100}%` }}
                    />
                  </div>
                  <span className="text-sm text-text-secondary font-mono w-12 text-right">{f.pct}%</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Score Distribution */}
        {stats.scoreDistribution.length > 0 && (
          <div className="space-y-3 pt-4 border-t border-border-subtle">
            <h4 className="text-xs font-semibold text-text-tertiary uppercase tracking-wider">Score Distribution</h4>
            <div className="flex items-end gap-1.5 h-20">
              {stats.scoreDistribution.map((d) => {
                const maxCount = Math.max(...stats.scoreDistribution.map((x) => x.count), 1);
                const barHeight = Math.max((d.count / maxCount) * 100, 8);
                return (
                  <div key={d.label} className="flex-1 flex flex-col items-center justify-end h-full" title={`${d.label}: ${d.count} repos`}>
                    <div
                      className="w-full rounded-t bg-accent hover:bg-accent-hover transition-all duration-300"
                      style={{ height: `${barHeight}%`, minHeight: "4px" }}
                    />
                    <span className="text-xs text-text-tertiary mt-1 shrink-0">{d.label}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

interface SeverityBreakdownProps {
  severe: number;
  high: number;
  low: number;
  total: number;
}

function SeverityBreakdown({ severe, high, low, total }: SeverityBreakdownProps) {
  const severePct = total > 0 ? (severe / total) * 100 : 0;
  const highPct = total > 0 ? (high / total) * 100 : 0;
  const lowPct = total > 0 ? (low / total) * 100 : 0;

  return (
    <div className="rounded-xl border border-border-default bg-surface-1 p-4 space-y-3" role="region" aria-label="Severity breakdown">
      <h4 className="text-xs font-semibold text-text-tertiary uppercase tracking-wider">Severity Breakdown</h4>
      
      {/* Stacked Bar */}
      <div className="h-3 rounded-full bg-surface-3 overflow-hidden flex">
        {severePct > 0 && (
          <div 
            className="h-full bg-danger transition-all duration-500" 
            style={{ width: `${severePct}%` }}
            title={`Severe: ${severe} repos (${severePct.toFixed(1)}%)`}
          />
        )}
        {highPct > 0 && (
          <div 
            className="h-full bg-severe transition-all duration-500" 
            style={{ width: `${highPct}%` }}
            title={`High: ${high} repos (${highPct.toFixed(1)}%)`}
          />
        )}
        {lowPct > 0 && (
          <div 
            className="h-full bg-success transition-all duration-500" 
            style={{ width: `${lowPct}%` }}
            title={`Low: ${low} repos (${lowPct.toFixed(1)}%)`}
          />
        )}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 text-xs">
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-danger" />
          <span className="text-text-tertiary">Severe</span>
          <span className="font-mono text-text-secondary">{severe}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-severe" />
          <span className="text-text-tertiary">High</span>
          <span className="font-mono text-text-secondary">{high}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-success" />
          <span className="text-text-tertiary">Low</span>
          <span className="font-mono text-text-secondary">{low}</span>
        </div>
      </div>
    </div>
  );
}

interface ScanProgressCardProps {
  statusInfo: ScanStatusInfo;
}

function ScanProgressCard({ statusInfo }: ScanProgressCardProps) {
  const total = statusInfo.totalRepoCount;
  const processed = statusInfo.processedRepoCount;
  const pct = total > 0 ? Math.round((processed / total) * 100) : 0;

  const elapsed = statusInfo.startedAt
    ? Math.max(0, Math.floor((Date.now() - new Date(statusInfo.startedAt).getTime()) / 1000))
    : 0;
  const elapsedStr = elapsed > 0 ? (elapsed < 60 ? `${elapsed}s` : `${Math.floor(elapsed / 60)}m ${elapsed % 60}s`) : "";

  return (
    <div className="rounded-xl border border-warning/20 bg-warning-subtle p-4 space-y-3" role="status" aria-live="polite">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-warning opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-warning" />
          </div>
          <span className="text-sm font-medium text-warning">Scanning in progress</span>
        </div>
        {elapsedStr && (
          <span className="text-xs text-text-quaternary">{elapsedStr}</span>
        )}
      </div>
      
      {total > 0 && (
        <>
          <div className="h-2 rounded-full bg-surface-3 overflow-hidden">
            <div
              className="h-full rounded-full bg-warning transition-all duration-500"
              style={{ width: `${Math.max(pct, 2)}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-text-tertiary">
              <span className="font-mono font-medium text-text-secondary">{processed}</span> of{" "}
              <span className="font-mono">{total}</span> repos processed
            </span>
            <span className="font-mono text-warning">{pct}%</span>
          </div>
        </>
      )}
    </div>
  );
}
