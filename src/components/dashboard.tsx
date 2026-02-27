"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { signOut } from "next-auth/react";
import Image from "next/image";
import { useToast } from "./toast";
import { ConfirmModal } from "./confirm-modal";
import { TableSkeleton, StatsSkeleton, OrgStatsSkeleton } from "./skeletons";
import { useTheme } from "./theme-provider";
import { relativeTime } from "@/lib/relative-time";
import { Tabs, TabList, TabTrigger, TabContent } from "./tabs";
import { OverviewTab, RepositoriesTab, HistoryTab } from "./dashboard/index";

interface Org {
  id: string;
  name: string;
  githubOrgId: string;
  scans?: { id: string; status: string }[];
}

interface ScanResult {
  rank: number;
  repoName: string;
  rotScore: number;
  severity: string;
  lastCommit: string | null;
  scoreBreakdown: Record<string, number>;
  archived: boolean;
}

interface GithubOrg {
  id: string;
  login: string;
  avatar_url: string;
  connected: boolean;
}

interface RateLimitInfo {
  remaining: number;
  limit: number;
  resetsAt: string;
}

interface ScanStatusInfo {
  status: string;
  startedAt: string;
  totalRepoCount: number;
  processedRepoCount: number;
}

interface ScanHistoryItem {
  id: string;
  status: string;
  startedAt: string;
  completedAt: string | null;
  repoCount: number;
}

interface OrgStats {
  totalRepos: number;
  avgScore: number;
  severeCount: number;
  highCount: number;
  lowCount: number;
  severePct: number;
  topRotFactors: { factor: string; count: number; pct: number }[];
  scoreDistribution: { label: string; count: number }[];
  totalScans: number;
}

interface ScanDiff {
  scanA: { id: string; startedAt: string; completedAt: string | null; repoCount: number };
  scanB: { id: string; startedAt: string; completedAt: string | null; repoCount: number };
  summary: { improved: number; worsened: number; unchanged: number; added: number; removed: number };
  diff: { repoName: string; scoreA: number | null; scoreB: number | null; delta: number; severityA: string | null; severityB: string | null; status: string }[];
}

interface CrossOrgResult {
  repoName: string;
  orgName: string;
  orgId: string;
  rotScore: number;
  severity: string;
  lastCommit: string | null;
  archived: boolean;
  scoreBreakdown: Record<string, number>;
}

function RateLimitBadge({ rateLimit }: { rateLimit: RateLimitInfo | null }) {
  if (!rateLimit) return null;

  const used = rateLimit.limit - rateLimit.remaining;
  const usedPct = rateLimit.limit > 0 ? (used / rateLimit.limit) * 100 : 0;
  const remainPct = 100 - usedPct;

  const color =
    remainPct < 10
      ? "text-danger bg-danger-subtle border-danger/20"
      : remainPct < 30
      ? "text-warning bg-warning-subtle border-warning/20"
      : "text-text-tertiary bg-surface-2 border-border-default";

  const barColor =
    remainPct < 10 ? "bg-danger" : remainPct < 30 ? "bg-warning" : "bg-success";

  const resetsIn = Math.max(
    0,
    Math.ceil((new Date(rateLimit.resetsAt).getTime() - Date.now()) / 60_000)
  );

  return (
    <div
      className={`flex items-center gap-2 px-2.5 py-1 rounded-lg border text-xs font-medium transition-colors ${color}`}
      title={`GitHub API: ${rateLimit.remaining} of ${rateLimit.limit} requests remaining. Resets in ${resetsIn}m.`}
      role="status"
      aria-label={`API rate limit: ${rateLimit.remaining} of ${rateLimit.limit} remaining`}
    >
      <svg className="w-3 h-3 shrink-0" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
        <path d="M8 0a8 8 0 1 1 0 16A8 8 0 0 1 8 0ZM1.5 8a6.5 6.5 0 1 0 13 0 6.5 6.5 0 0 0-13 0Zm7-3.25v2.992l2.028.812a.75.75 0 0 1-.557 1.392l-2.5-1A.751.751 0 0 1 7 8.25v-3.5a.75.75 0 0 1 1.5 0Z" />
      </svg>
      <div className="hidden sm:flex items-center gap-1.5">
        <span className="font-mono">{used.toLocaleString()}</span>
        <span className="text-text-quaternary">/</span>
        <span className="font-mono text-text-quaternary">{rateLimit.limit.toLocaleString()}</span>
        <span className="text-text-quaternary">used</span>
      </div>
      <span className="sm:hidden font-mono">{rateLimit.remaining.toLocaleString()}</span>
      <div className="h-1.5 w-10 rounded-full bg-surface-3 overflow-hidden" role="progressbar" aria-valuenow={rateLimit.remaining} aria-valuemax={rateLimit.limit}>
        <div
          className={`h-full rounded-full transition-all duration-500 ${barColor}`}
          style={{ width: `${Math.max(remainPct, 2)}%` }}
        />
      </div>
      {resetsIn > 0 && usedPct > 0 && (
        <span className="hidden md:inline text-text-quaternary">({resetsIn}m)</span>
      )}
    </div>
  );
}

function ScanProgress({ statusInfo, isScanning }: { statusInfo: ScanStatusInfo | null; isScanning: boolean }) {
  if (!statusInfo && !isScanning) return null;

  const status = statusInfo?.status ?? (isScanning ? "queued" : null);
  if (!status) return null;

  const isActive = status === "running" || status === "queued";
  const total = statusInfo?.totalRepoCount ?? 0;
  const processed = statusInfo?.processedRepoCount ?? 0;
  const pct = total > 0 ? Math.round((processed / total) * 100) : 0;

  const elapsed = statusInfo?.startedAt
    ? Math.max(0, Math.floor((Date.now() - new Date(statusInfo.startedAt).getTime()) / 1000))
    : 0;
  const elapsedStr = elapsed > 0 ? (elapsed < 60 ? `${elapsed}s` : `${Math.floor(elapsed / 60)}m ${elapsed % 60}s`) : "";

  return (
    <div className="flex items-center gap-2.5" role="status" aria-live="polite" aria-label={`Scan ${status}: ${processed} of ${total} repos processed`}>
      {isActive && (
        <div className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-warning opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-warning" />
        </div>
      )}
      <div className="flex flex-col gap-0.5">
        <div className="flex items-center gap-2 text-xs font-medium">
          <span>
            Status:{" "}
            <span
              className={
                status === "completed"
                  ? "text-success"
                  : status === "failed"
                  ? "text-danger"
                  : "text-warning"
              }
            >
              {status}
            </span>
          </span>
          {isActive && total > 0 && (
            <span className="text-text-tertiary font-mono">
              {processed}/{total} repos
            </span>
          )}
          {isActive && elapsedStr && (
            <span className="text-text-quaternary">{elapsedStr}</span>
          )}
        </div>
        {isActive && total > 0 && (
          <div className="h-1 w-32 rounded-full bg-surface-3 overflow-hidden" role="progressbar" aria-valuenow={processed} aria-valuemax={total}>
            <div
              className="h-full rounded-full bg-warning transition-all duration-500"
              style={{ width: `${Math.max(pct, 2)}%` }}
            />
          </div>
        )}
      </div>
    </div>
  );
}

function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  return (
    <button
      onClick={toggleTheme}
      className="flex items-center justify-center h-7 w-7 rounded-lg border border-border-default bg-surface-1 text-text-tertiary hover:text-text-primary hover:bg-surface-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
      aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
      title={`Switch to ${theme === "dark" ? "light" : "dark"} mode (Ctrl+Shift+L)`}
    >
      {theme === "dark" ? (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
        </svg>
      ) : (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/>
        </svg>
      )}
    </button>
  );
}

function RateLimitWarning({ rateLimit, repoEstimate, onProceed, onCancel }: {
  rateLimit: RateLimitInfo;
  repoEstimate: number;
  onProceed: () => void;
  onCancel: () => void;
}) {
  const estimatedCost = repoEstimate * 5;
  return (
    <div className="animate-fade-in-up rounded-xl border border-warning/20 bg-warning-subtle px-4 py-3 space-y-2" role="alert">
      <div className="flex items-start gap-2">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-warning shrink-0 mt-0.5" aria-hidden="true">
          <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.072 16.5c-.77.833.192 2.5 1.732 2.5z" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        <div className="flex-1 text-sm">
          <p className="font-medium text-warning">Low API rate limit</p>
          <p className="text-text-tertiary text-xs mt-0.5">
            {rateLimit.remaining.toLocaleString()} requests remaining. Scanning ~{repoEstimate} repos needs ~{estimatedCost.toLocaleString()} requests. The scan may hit rate limits.
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2 pl-6">
        <button
          onClick={onProceed}
          className="text-xs font-medium text-warning hover:text-warning/80 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-warning/50 rounded px-2 py-1"
        >
          Scan anyway
        </button>
        <button
          onClick={onCancel}
          className="text-xs text-text-quaternary hover:text-text-secondary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 rounded px-2 py-1"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

function CrossOrgSearch({ onClose }: { onClose: () => void }) {
  const [query, setQuery] = useState("");
  const [severity, setSeverity] = useState<string>("");
  const [results, setResults] = useState<CrossOrgResult[]>([]);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const doSearch = useCallback((q: string, sev: string) => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (sev) params.set("severity", sev);
    setLoading(true);
    fetch(`/api/repos/search?${params}`)
      .then((r) => r.ok ? r.json() : { results: [] })
      .then((data) => setResults(data.results ?? []))
      .catch(() => setResults([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(query, severity), 300);
    return () => clearTimeout(debounceRef.current);
  }, [query, severity, doSearch]);

  return (
    <div className="rounded-xl border border-border-default bg-surface-1 overflow-hidden animate-fade-in-up" role="dialog" aria-label="Search across all organizations">
      <div className="px-4 py-2.5 border-b border-border-subtle flex items-center justify-between">
        <h3 className="text-[11px] font-semibold text-text-quaternary uppercase tracking-wider">Cross-Org Search</h3>
        <button onClick={onClose} className="text-text-quaternary hover:text-text-secondary transition-colors rounded p-0.5" aria-label="Close search">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M18 6L6 18M6 6l12 12" strokeLinecap="round"/></svg>
        </button>
      </div>
      <div className="px-4 py-3 border-b border-border-subtle flex flex-col sm:flex-row gap-2">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search repos across all orgs..."
          className="flex-1 rounded-lg border border-border-default bg-surface-0 px-3 py-1.5 text-sm placeholder-text-quaternary transition-colors focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/20"
          autoFocus
          aria-label="Search query"
        />
        <select
          value={severity}
          onChange={(e) => setSeverity(e.target.value)}
          className="rounded-lg border border-border-default bg-surface-0 px-3 py-1.5 text-xs text-text-secondary focus:outline-none focus:border-accent/50"
          aria-label="Filter by severity"
        >
          <option value="">All severities</option>
          <option value="severe">Severe</option>
          <option value="high">High</option>
          <option value="low">Low</option>
        </select>
      </div>
      <div className="max-h-64 overflow-y-auto">
        {loading ? (
          <div className="p-4 text-center text-text-quaternary text-xs animate-pulse">Searching...</div>
        ) : results.length === 0 ? (
          <div className="p-4 text-center text-text-quaternary text-xs">
            {query ? "No results found." : "Start typing to search across all organizations."}
          </div>
        ) : (
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border-subtle">
                <th className="py-2 px-4 text-left text-text-quaternary font-semibold">Repo</th>
                <th className="py-2 px-4 text-left text-text-quaternary font-semibold">Org</th>
                <th className="py-2 px-4 text-center text-text-quaternary font-semibold">Score</th>
                <th className="py-2 px-4 text-center text-text-quaternary font-semibold">Severity</th>
              </tr>
            </thead>
            <tbody>
              {results.slice(0, 50).map((r, i) => (
                <tr key={`${r.orgName}-${r.repoName}-${i}`} className="border-b border-border-subtle last:border-b-0 hover:bg-surface-2 transition-colors">
                  <td className="py-2 px-4 text-text-secondary font-medium">{r.repoName}</td>
                  <td className="py-2 px-4 text-text-tertiary">{r.orgName}</td>
                  <td className={`py-2 px-4 text-center font-mono font-bold ${r.rotScore >= 10 ? "text-danger" : r.rotScore >= 7 ? "text-severe" : "text-success"}`}>{r.rotScore}</td>
                  <td className="py-2 px-4 text-center capitalize">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold uppercase border ${
                      r.severity === "severe" ? "bg-danger-subtle text-danger border-danger/20" :
                      r.severity === "high" ? "bg-severe-subtle text-severe border-severe/20" :
                      "bg-success-subtle text-success border-success/20"
                    }`}>{r.severity}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function ConfettiEffect() {
  const [particles, setParticles] = useState<{ id: number; x: number; delay: number; color: string }[]>([]);

  useEffect(() => {
    const colors = ["#22c55e", "#6366f1", "#f59e0b", "#ef4444", "#f97316"];
    const p = Array.from({ length: 30 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      delay: Math.random() * 0.5,
      color: colors[Math.floor(Math.random() * colors.length)],
    }));
    setParticles(p);
    const timer = setTimeout(() => setParticles([]), 2500);
    return () => clearTimeout(timer);
  }, []);

  if (particles.length === 0) return null;

  return (
    <div className="fixed inset-0 pointer-events-none z-[200]" aria-hidden="true">
      {particles.map((p) => (
        <div
          key={p.id}
          className="absolute w-2 h-2 rounded-full animate-confetti"
          style={{
            left: `${p.x}%`,
            top: "-8px",
            backgroundColor: p.color,
            animationDelay: `${p.delay}s`,
          }}
        />
      ))}
    </div>
  );
}

interface ActionsMenuProps {
  showExport: boolean;
  showShare: boolean;
  showDelete: boolean;
  shareToken: string | null;
  shareLoading: boolean;
  onExport: () => void;
  onShare: () => void;
  onRevokeShare: () => void;
  onDelete: () => void;
  orgName: string;
}

function ActionsMenu({
  showExport,
  showShare,
  showDelete,
  shareToken,
  shareLoading,
  onExport,
  onShare,
  onRevokeShare,
  onDelete,
  orgName,
}: ActionsMenuProps) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const hasAnyAction = showExport || showShare || showDelete;

  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open]);

  if (!hasAnyAction) return null;

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setOpen(!open)}
        className={`rounded-lg p-2 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 ${
          open 
            ? "bg-surface-3 text-text-primary" 
            : "text-text-tertiary hover:text-text-secondary hover:bg-surface-2"
        }`}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label="Actions menu"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <circle cx="12" cy="5" r="1" fill="currentColor"/>
          <circle cx="12" cy="12" r="1" fill="currentColor"/>
          <circle cx="12" cy="19" r="1" fill="currentColor"/>
        </svg>
      </button>

      {open && (
        <div 
          className="absolute right-0 top-full mt-1 w-48 rounded-lg border border-border-default bg-surface-1 shadow-lg py-1 z-50 animate-fade-in"
          role="menu"
        >
          {showExport && (
            <button
              onClick={() => { onExport(); setOpen(false); }}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-text-secondary hover:bg-surface-2 hover:text-text-primary transition-colors"
              role="menuitem"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Export CSV
            </button>
          )}

          {showShare && (
            <>
              <button
                onClick={() => { onShare(); setOpen(false); }}
                disabled={shareLoading}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-text-secondary hover:bg-surface-2 hover:text-text-primary transition-colors disabled:opacity-50"
                role="menuitem"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8M16 6l-4-4-4 4M12 2v13" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                {shareLoading ? "Generating..." : shareToken ? "Copy Share Link" : "Share Results"}
              </button>

              {shareToken && (
                <button
                  onClick={() => { onRevokeShare(); setOpen(false); }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-text-secondary hover:bg-surface-2 hover:text-danger transition-colors"
                  role="menuitem"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                    <path d="M18.36 6.64A9 9 0 115.64 18.36 9 9 0 0118.36 6.64zM15 9l-6 6M9 9l6 6" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  Revoke Share Link
                </button>
              )}
            </>
          )}

          {(showExport || showShare) && showDelete && (
            <div className="my-1 border-t border-border-subtle" role="separator" />
          )}

          {showDelete && (
            <button
              onClick={() => { onDelete(); setOpen(false); }}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-danger hover:bg-danger-subtle transition-colors"
              role="menuitem"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Delete {orgName || "Organization"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function MobileMenu({
  open,
  onClose,
  user,
  plan,
  onUpgrade,
  onSignOut,
}: {
  open: boolean;
  onClose: () => void;
  user: { name: string; image: string };
  plan: string;
  onUpgrade: () => void;
  onSignOut: () => void;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80] md:hidden">
      <div className="absolute inset-0 bg-surface-0/60 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />
      <nav
        className="absolute right-0 top-0 h-full w-64 bg-surface-1 border-l border-border-default shadow-2xl animate-slide-in-right p-5 space-y-4"
        role="dialog"
        aria-modal="true"
        aria-label="Mobile menu"
      >
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold">Menu</span>
          <button onClick={onClose} className="text-text-quaternary hover:text-text-secondary transition-colors p-1" aria-label="Close menu">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M18 6L6 18M6 6l12 12" strokeLinecap="round"/></svg>
          </button>
        </div>
        <div className="flex items-center gap-2 py-3 border-b border-border-subtle">
          {user.image && (
            <Image src={user.image} alt="" width={24} height={24} className="rounded-full" />
          )}
          <span className="text-sm text-text-secondary">{user.name}</span>
          <span className={`px-1.5 py-0.5 rounded font-medium text-xs uppercase tracking-wider ${
            plan === "pro" ? "bg-accent-subtle text-accent" : "bg-surface-3 text-text-quaternary"
          }`}>{plan}</span>
        </div>
        <div className="space-y-2">
          <ThemeToggle />
          {plan === "free" && (
            <button onClick={onUpgrade} className="w-full text-left text-sm text-accent hover:text-accent-hover transition-colors py-2">
              Upgrade to Pro
            </button>
          )}
          <button onClick={onSignOut} className="w-full text-left text-sm text-text-quaternary hover:text-text-secondary transition-colors py-2">
            Sign out
          </button>
        </div>
      </nav>
    </div>
  );
}

export function Dashboard({
  user,
  orgs: initialOrgs,
  plan: initialPlan,
}: {
  user: { id: string; name: string; image: string };
  orgs: Org[];
  plan: string;
}) {
  const { toast } = useToast();
  const [orgs, setOrgs] = useState<Org[]>(initialOrgs);
  const [availableOrgs, setAvailableOrgs] = useState<GithubOrg[]>([]);
  const [selectedOrgId, setSelectedOrgId] = useState<string>(
    initialOrgs[0]?.id ?? ""
  );
  const [scanId, setScanId] = useState<string | null>(null);
  const [scanStatus, setScanStatus] = useState<string | null>(null);
  const [scanStatusInfo, setScanStatusInfo] = useState<ScanStatusInfo | null>(null);
  const [results, setResults] = useState<ScanResult[]>([]);
  const [selectedResult, setSelectedResult] = useState<ScanResult | null>(null);
  const [scanLoading, setScanLoading] = useState(false);
  const [orgLoading, setOrgLoading] = useState(false);
  const [resultsLoading, setResultsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [manualOrgName, setManualOrgName] = useState("");
  const [showAddOrg, setShowAddOrg] = useState(initialOrgs.length === 0);
  const [plan, setPlan] = useState(initialPlan);
  const [rateLimit, setRateLimit] = useState<RateLimitInfo | null>(null);
  const [deleteModalOrg, setDeleteModalOrg] = useState<{ id: string; name: string } | null>(null);
  const [scanHistory, setScanHistory] = useState<ScanHistoryItem[]>([]);
  const [scanHistoryLoading, setScanHistoryLoading] = useState(false);
  const [lastScanTime, setLastScanTime] = useState<string | null>(null);
  const [rateLimitWarning, setRateLimitWarning] = useState(false);
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const [orgStats, setOrgStats] = useState<OrgStats | null>(null);
  const [orgStatsLoading, setOrgStatsLoading] = useState(false);
  const [showCrossOrgSearch, setShowCrossOrgSearch] = useState(false);
  const [scanDiff, setScanDiff] = useState<ScanDiff | null>(null);
  const [shareToken, setShareToken] = useState<string | null>(null);
  const [shareLoading, setShareLoading] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [isFirstScan, setIsFirstScan] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [previousScores, setPreviousScores] = useState<Map<string, number>>(new Map());

  const latestOrgIdRef = useRef(selectedOrgId);
  const sseRef = useRef<EventSource | null>(null);
  const lastRateLimitRefresh = useRef(0);
  const newlyAddedOrgIds = useRef<Set<string>>(new Set());
  const setActiveTabRef = useRef<((tab: "overview" | "repositories" | "history") => void) | null>(null);

  useEffect(() => {
    latestOrgIdRef.current = selectedOrgId;
  }, [selectedOrgId]);

  useEffect(() => {
    fetch("/api/orgs")
      .then((r) => r.json())
      .then((data) => {
        if (data.available) setAvailableOrgs(data.available);
      })
      .catch(() => {});
  }, []);

  const refreshRateLimit = useCallback(() => {
    fetch("/api/github/rate-limit")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.remaining != null && data?.limit != null) setRateLimit(data);
      })
      .catch(() => {});
  }, []);

  const throttledRefreshRateLimit = useCallback(() => {
    const now = Date.now();
    if (now - lastRateLimitRefresh.current < 15000) return;
    lastRateLimitRefresh.current = now;
    refreshRateLimit();
  }, [refreshRateLimit]);

  useEffect(() => {
    refreshRateLimit();
    const interval = setInterval(refreshRateLimit, 60000);
    return () => clearInterval(interval);
  }, [refreshRateLimit]);

  const fetchScanHistory = useCallback((orgId: string) => {
    setScanHistoryLoading(true);
    fetch(`/api/orgs/${orgId}/scans`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.scans) setScanHistory(data.scans);
      })
      .catch(() => {})
      .finally(() => setScanHistoryLoading(false));
  }, []);

  const fetchOrgStats = useCallback((orgId: string) => {
    setOrgStatsLoading(true);
    fetch(`/api/orgs/${orgId}/stats`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data) setOrgStats(data);
      })
      .catch(() => {})
      .finally(() => setOrgStatsLoading(false));
  }, []);

  useEffect(() => {
    if (!selectedOrgId) {
      setScanId(null);
      setScanStatus(null);
      setScanStatusInfo(null);
      setResults([]);
      setSelectedResult(null);
      setScanHistory([]);
      setLastScanTime(null);
      setSelectedRows(new Set());
      setOrgStats(null);
      setScanDiff(null);
      setShareToken(null);
      setPreviousScores(new Map());
      return;
    }

    // Skip fetching for optimistic temp IDs - they have no data yet
    if (selectedOrgId.startsWith("temp-")) {
      setScanId(null);
      setScanStatus(null);
      setScanStatusInfo(null);
      setResults([]);
      setSelectedResult(null);
      setScanHistory([]);
      setLastScanTime(null);
      setSelectedRows(new Set());
      setOrgStats(null);
      setScanDiff(null);
      setShareToken(null);
      setPreviousScores(new Map());
      setResultsLoading(false);
      return;
    }

    // Skip loading state for newly added orgs (no scan data yet)
    const isNewlyAdded = newlyAddedOrgIds.current.has(selectedOrgId);
    if (isNewlyAdded) {
      newlyAddedOrgIds.current.delete(selectedOrgId);
      setScanId(null);
      setScanStatus(null);
      setScanStatusInfo(null);
      setResults([]);
      setSelectedResult(null);
      setScanHistory([]);
      setLastScanTime(null);
      setSelectedRows(new Set());
      setOrgStats(null);
      setScanDiff(null);
      setShareToken(null);
      setPreviousScores(new Map());
      setResultsLoading(false);
      return;
    }

    const abortController = new AbortController();

    setScanId(null);
    setScanStatus(null);
    setScanStatusInfo(null);
    setResults([]);
    setSelectedResult(null);
    setError(null);
    setResultsLoading(true);
    setSelectedRows(new Set());
    setScanDiff(null);
    setShareToken(null);

    fetch(`/api/orgs/${selectedOrgId}/latest-scan`, {
      signal: abortController.signal,
    })
      .then((r) => r.json())
      .then((data) => {
        if (abortController.signal.aborted) return;
        if (latestOrgIdRef.current !== selectedOrgId) return;
        if (data.scan) {
          setScanId(data.scan.id);
          setScanStatus(data.scan.status);
          setResults(data.results);
          if (data.scan.completedAt) {
            setLastScanTime(data.scan.completedAt);
          }
          // Populate status info for running/queued scans
          if (data.scan.status === "running" || data.scan.status === "queued") {
            setScanStatusInfo({
              status: data.scan.status,
              startedAt: data.scan.startedAt,
              totalRepoCount: data.scan.totalRepoCount ?? 0,
              processedRepoCount: data.scan.processedRepoCount ?? 0,
            });
          }
        }
      })
      .catch((e) => {
        if (e instanceof DOMException && e.name === "AbortError") return;
        setError("Failed to load latest scan");
      })
      .finally(() => setResultsLoading(false));

    fetchScanHistory(selectedOrgId);
    fetchOrgStats(selectedOrgId);

    return () => abortController.abort();
  }, [selectedOrgId, fetchScanHistory, fetchOrgStats]);

  const fetchPreviousScores = useCallback(
    async (currentScanId: string, history: ScanHistoryItem[]) => {
      const completed = history.filter((s) => s.status === "completed");
      const idx = completed.findIndex((s) => s.id === currentScanId);
      const prevScan = idx >= 0 ? completed[idx + 1] : completed.length > 1 ? completed[1] : null;
      if (!prevScan) {
        setPreviousScores(new Map());
        return;
      }
      try {
        const res = await fetch(`/api/scan/${prevScan.id}/results`);
        if (res.ok) {
          const data = await res.json();
          const map = new Map<string, number>();
          for (const r of data.results ?? []) {
            map.set(r.repoName, r.rotScore);
          }
          setPreviousScores(map);
        }
      } catch {
        setPreviousScores(new Map());
      }
    },
    []
  );

  const fetchResults = useCallback(
    async (id: string, signal?: AbortSignal) => {
      try {
        const res = await fetch(`/api/scan/${id}/results`, { signal });
        if (res.ok) {
          const data = await res.json();
          if (signal?.aborted) return;
          setResults(data.results);
          setScanStatus(data.scan.status);
          if (data.scan.completedAt) {
            setLastScanTime(data.scan.completedAt);
          }
        }
      } catch (e) {
        if (e instanceof DOMException && e.name === "AbortError") return;
      }
    },
    []
  );

  const connectSSE = useCallback((scanIdVal: string) => {
    sseRef.current?.close();

    const es = new EventSource(`/api/scan/${scanIdVal}/stream`);
    sseRef.current = es;

    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "progress") {
          setScanStatus(data.status);
          setScanStatusInfo({
            status: data.status,
            startedAt: data.startedAt,
            totalRepoCount: data.totalRepoCount,
            processedRepoCount: data.processedRepoCount,
          });
          throttledRefreshRateLimit();
        }
        if (data.type === "done") {
          es.close();
          sseRef.current = null;
          refreshRateLimit();
          if (data.status === "completed") {
            setScanStatus("completed");
            fetchResults(scanIdVal);
            toast(`Scan complete — ${data.repoCount ?? 0} repos analyzed`, "success");
            if (selectedOrgId) {
              fetchScanHistory(selectedOrgId);
              fetchOrgStats(selectedOrgId);
            }
            if (isFirstScan) {
              setShowConfetti(true);
              setIsFirstScan(false);
              setTimeout(() => setShowConfetti(false), 3000);
            }
            if (document.hidden) {
              try {
                if ("Notification" in window && Notification.permission === "granted") {
                  new Notification("Repo Rot Detector", {
                    body: `Scan complete — ${data.repoCount ?? 0} repos analyzed`,
                    icon: "/favicon.svg",
                  });
                }
              } catch {}
            }
          }
          if (data.status === "failed") {
            setScanStatus("failed");
            setError("Scan failed. This may be due to GitHub API rate limits or permission issues.");
            toast("Scan failed", "error");
          }
        }
      } catch {}
    };

    es.onerror = () => {
      es.close();
      sseRef.current = null;
    };
  }, [fetchResults, refreshRateLimit, throttledRefreshRateLimit, toast, selectedOrgId, fetchScanHistory, fetchOrgStats, isFirstScan]);

  useEffect(() => {
    if (!scanId || scanStatus === "completed" || scanStatus === "failed") return;
    connectSSE(scanId);
    return () => {
      sseRef.current?.close();
      sseRef.current = null;
    };
  }, [scanId, scanStatus, connectSSE]);

  useEffect(() => {
    if (scanId && scanStatus === "completed" && scanHistory.length > 0) {
      fetchPreviousScores(scanId, scanHistory);
    }
  }, [scanId, scanStatus, scanHistory, fetchPreviousScores]);

  useEffect(() => {
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission().catch(() => {});
    }
  }, []);

  async function connectOrg(ghOrg: GithubOrg) {
    const optimisticOrg: Org = {
      id: `temp-${ghOrg.id}`,
      name: ghOrg.login,
      githubOrgId: ghOrg.id,
    };
    setOrgs((prev) => [...prev, optimisticOrg]);
    setSelectedOrgId(optimisticOrg.id);
    setShowAddOrg(false);
    setOrgLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/orgs/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ githubOrgId: ghOrg.id, name: ghOrg.login }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
      newlyAddedOrgIds.current.add(data.id);
      setOrgs((prev) => prev.map((o) => (o.id === optimisticOrg.id ? data : o)));
      setSelectedOrgId(data.id);
      toast(`Connected ${ghOrg.login}`, "success");
    } catch (e) {
      setOrgs((prev) => prev.filter((o) => o.id !== optimisticOrg.id));
      setSelectedOrgId("");
      setError(e instanceof Error ? e.message : "Failed to connect org");
    } finally {
      setOrgLoading(false);
    }
  }

  async function addOrgByName() {
    const name = manualOrgName.trim();
    if (!name) return;

    const optimisticOrg: Org = {
      id: `temp-${name}`,
      name,
      githubOrgId: "",
    };
    setOrgs((prev) => [...prev, optimisticOrg]);
    setSelectedOrgId(optimisticOrg.id);
    setManualOrgName("");
    setShowAddOrg(false);
    setOrgLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/orgs/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
      newlyAddedOrgIds.current.add(data.id);
      setOrgs((prev) => prev.map((o) => (o.id === optimisticOrg.id ? data : o)));
      setSelectedOrgId(data.id);
      toast(`Added ${name}`, "success");
    } catch (e) {
      setOrgs((prev) => prev.filter((o) => o.id !== optimisticOrg.id));
      setSelectedOrgId("");
      setError(e instanceof Error ? e.message : "Failed to add org");
    } finally {
      setOrgLoading(false);
    }
  }

  async function startScan() {
    if (!selectedOrgId) return;

    if (rateLimit && rateLimit.remaining < 500 && !rateLimitWarning) {
      setRateLimitWarning(true);
      return;
    }
    setRateLimitWarning(false);

    sseRef.current?.close();
    sseRef.current = null;
    setScanLoading(true);
    setError(null);
    setResults([]);
    setSelectedResult(null);
    setScanStatusInfo(null);
    setSelectedRows(new Set());
    setScanDiff(null);

    const hadPreviousScan = scanHistory.length > 0;
    if (!hadPreviousScan) setIsFirstScan(true);

    try {
      const res = await fetch("/api/scan/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orgId: selectedOrgId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
      setScanId(data.id);
      setScanStatus(data.status);
      refreshRateLimit();
      toast("Scan started", "info");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to start scan");
      setIsFirstScan(false);
    } finally {
      setScanLoading(false);
    }
  }

  async function retryScan() {
    setScanStatus(null);
    setScanId(null);
    setError(null);
    startScan();
  }

  async function exportCSV() {
    if (!scanId) return;
    window.open(`/api/scan/${scanId}/export`, "_blank");
  }

  function exportSubsetCSV() {
    if (selectedRows.size === 0) return;
    const subset = results.filter((r) => selectedRows.has(r.repoName));
    const headers = ["Rank", "Repo Name", "Rot Score", "Severity", "Last Commit", "Archived"];
    const rows = subset.map((r) => [
      r.rank,
      r.repoName.includes(",") || r.repoName.includes('"') ? `"${r.repoName.replace(/"/g, '""')}"` : r.repoName,
      r.rotScore,
      r.severity,
      r.lastCommit ?? "N/A",
      r.archived ? "Yes" : "No",
    ]);
    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `scan-subset-${selectedRows.size}-repos.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast(`Exported ${selectedRows.size} repos`, "success");
  }

  function requestDeleteOrg() {
    if (!selectedOrgId) return;
    const org = orgs.find((o) => o.id === selectedOrgId);
    if (org) setDeleteModalOrg({ id: org.id, name: org.name });
  }

  async function confirmDeleteOrg() {
    if (!deleteModalOrg) return;
    const { id, name } = deleteModalOrg;
    setDeleteModalOrg(null);

    const removedOrg = orgs.find((o) => o.id === id);
    setOrgs((prev) => prev.filter((o) => o.id !== id));
    setSelectedOrgId("");
    setScanId(null);
    setScanStatus(null);
    setScanStatusInfo(null);
    setResults([]);
    setSelectedResult(null);
    setScanHistory([]);
    setSelectedRows(new Set());
    setOrgStats(null);

    setError(null);
    try {
      const res = await fetch(`/api/orgs/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
      toast(`Deleted ${name}`, "success");
    } catch (e) {
      if (removedOrg) {
        setOrgs((prev) => [...prev, removedOrg]);
        setSelectedOrgId(id);
      }
      setError(e instanceof Error ? e.message : "Failed to delete org");
    }
  }

  async function loadHistoricalScan(historyScanId: string) {
    setResultsLoading(true);
    setSelectedResult(null);
    setSelectedRows(new Set());
    setScanDiff(null);
    setShareToken(null);
    try {
      const res = await fetch(`/api/scan/${historyScanId}/results`);
      if (res.ok) {
        const data = await res.json();
        setScanId(data.scan.id);
        setScanStatus(data.scan.status);
        setResults(data.results);
        if (data.scan.completedAt) setLastScanTime(data.scan.completedAt);
        // Navigate to repositories tab to show the loaded scan
        setActiveTabRef.current?.("repositories");
      }
    } catch {
      setError("Failed to load scan results");
    } finally {
      setResultsLoading(false);
    }
  }

  async function loadScanDiff(scanA: string, scanB: string) {
    if (!scanA || !scanB) return;
    try {
      const res = await fetch(`/api/scan/diff?scanA=${scanA}&scanB=${scanB}`);
      if (res.ok) {
        const data = await res.json();
        setScanDiff(data);
      } else {
        toast("Failed to load scan diff", "error");
      }
    } catch {
      toast("Failed to load scan diff", "error");
    }
  }

  async function generateShareLink() {
    if (!scanId) return;
    setShareLoading(true);
    try {
      const res = await fetch(`/api/scan/${scanId}/share`, { method: "POST" });
      const data = await res.json();
      if (res.ok && data.shareToken) {
        setShareToken(data.shareToken);
        const url = `${window.location.origin}/share/${data.shareToken}`;
        await navigator.clipboard.writeText(url);
        toast("Share link copied to clipboard", "success");
      } else {
        throw new Error(data.error ?? "Failed to generate link");
      }
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed to generate share link", "error");
    } finally {
      setShareLoading(false);
    }
  }

  async function revokeShareLink() {
    if (!scanId) return;
    try {
      await fetch(`/api/scan/${scanId}/share`, { method: "DELETE" });
      setShareToken(null);
      toast("Share link revoked", "success");
    } catch {
      toast("Failed to revoke link", "error");
    }
  }

  async function upgradeToPro() {
    try {
      const res = await fetch("/api/stripe/create-checkout", { method: "POST" });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
      else throw new Error(data.error || "Failed to create checkout session");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to start upgrade");
    }
  }

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("upgrade") === "success") {
      setPlan("pro");
      window.history.replaceState({}, "", "/");
      toast("Welcome to Pro!", "success");
    }
  }, [toast]);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        if (showCrossOrgSearch) {
          setShowCrossOrgSearch(false);
        } else if (scanDiff) {
          setScanDiff(null);
        } else if (selectedResult) {
          setSelectedResult(null);
        } else if (mobileMenuOpen) {
          setMobileMenuOpen(false);
        }
      }
      if (e.key === "L" && e.ctrlKey && e.shiftKey) {
        e.preventDefault();
        document.querySelector<HTMLButtonElement>("[aria-label*='Switch to']")?.click();
      }
      if (e.key === "/" && !e.ctrlKey && !e.metaKey && !e.altKey) {
        const active = document.activeElement;
        if (active?.tagName !== "INPUT" && active?.tagName !== "TEXTAREA" && active?.tagName !== "SELECT") {
          e.preventDefault();
          document.getElementById("results-search")?.focus();
        }
      }
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [selectedResult, scanDiff, showCrossOrgSearch, mobileMenuOpen]);

  function toggleRowSelection(repoName: string) {
    setSelectedRows((prev) => {
      const next = new Set(prev);
      if (next.has(repoName)) next.delete(repoName);
      else next.add(repoName);
      return next;
    });
  }

  function selectAllRows() {
    if (selectedRows.size === results.length) {
      setSelectedRows(new Set());
    } else {
      setSelectedRows(new Set(results.map((r) => r.repoName)));
    }
  }

  const isScanning =
    scanLoading || scanStatus === "running" || scanStatus === "queued";

  const severeCount = results.filter((r) => r.severity === "severe").length;

  const orgName = orgs.find((o) => o.id === selectedOrgId)?.name;

  const completedScans = scanHistory.filter((s) => s.status === "completed");

  return (
    <div className="animate-fade-in">
      {showConfetti && <ConfettiEffect />}

      <header className="sticky top-0 z-50 border-b border-border-default bg-surface-0/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 sm:px-6 h-14">
          <div className="flex items-center gap-3">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-surface-2 border border-border-default">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="text-accent" aria-hidden="true">
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <h1 className="text-sm font-semibold tracking-tight">Repo Rot Detector</h1>
          </div>

          <div className="flex items-center gap-3">
            <RateLimitBadge rateLimit={rateLimit} />

            {orgs.length > 1 && (
              <button
                onClick={() => setShowCrossOrgSearch(!showCrossOrgSearch)}
                className="hidden sm:inline-flex items-center gap-1 text-xs text-text-quaternary hover:text-text-secondary transition-colors px-2 py-1 rounded-lg hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
                aria-label="Search across all organizations"
                title="Search across all organizations"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                Global
              </button>
            )}

            <ThemeToggle />

            <div className="hidden sm:flex items-center gap-1.5 text-xs text-text-tertiary">
              {user.image && (
                <Image src={user.image} alt="" width={20} height={20} className="rounded-full" />
              )}
              <span>{user.name}</span>
              <span className={`px-1.5 py-0.5 rounded font-medium text-xs uppercase tracking-wider ${
                plan === "pro"
                  ? "bg-accent-subtle text-accent"
                  : "bg-surface-3 text-text-quaternary"
              }`}>
                {plan}
              </span>
            </div>

            {plan === "free" && (
              <button
                onClick={upgradeToPro}
                className="hidden sm:inline-flex items-center gap-1.5 text-xs font-medium bg-accent hover:bg-accent-hover text-white px-3 py-1.5 rounded-lg transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 focus-visible:ring-offset-2 focus-visible:ring-offset-surface-0"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <path d="M13 10V3L4 14h7v7l9-11h-7z" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                Upgrade to Pro
              </button>
            )}

            <button
              onClick={() => signOut()}
              className="hidden sm:inline text-xs text-text-quaternary hover:text-text-secondary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 rounded"
            >
              Sign out
            </button>

            <button
              onClick={() => setMobileMenuOpen(true)}
              className="sm:hidden flex items-center justify-center h-7 w-7 rounded-lg border border-border-default bg-surface-1 text-text-tertiary hover:text-text-primary hover:bg-surface-2 transition-colors"
              aria-label="Open menu"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path d="M4 6h16M4 12h16M4 18h16" strokeLinecap="round"/>
              </svg>
            </button>
          </div>
        </div>
      </header>

      <MobileMenu
        open={mobileMenuOpen}
        onClose={() => setMobileMenuOpen(false)}
        user={user}
        plan={plan}
        onUpgrade={upgradeToPro}
        onSignOut={() => signOut()}
      />

      <div id="main-content" className="mx-auto max-w-7xl px-4 sm:px-6 py-6 space-y-6">
        {error && (
          <div role="alert" className="animate-fade-in-up flex items-start gap-3 rounded-xl border border-danger/20 bg-danger-subtle px-4 py-3">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-danger shrink-0 mt-0.5" aria-hidden="true">
              <circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>
            </svg>
            <span className="text-sm text-danger flex-1 break-words min-w-0">{error}</span>
            <div className="flex items-center gap-2 shrink-0">
              {scanStatus === "failed" && (
                <button
                  onClick={retryScan}
                  className="text-xs font-medium text-danger hover:text-danger/80 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger/50 rounded px-2 py-1"
                >
                  Retry
                </button>
              )}
              <button
                onClick={() => setError(null)}
                className="text-danger/60 hover:text-danger transition-colors shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger/50 rounded"
                aria-label="Dismiss error"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round"/>
                </svg>
              </button>
            </div>
          </div>
        )}

        {rateLimitWarning && rateLimit && (
          <RateLimitWarning
            rateLimit={rateLimit}
            repoEstimate={100}
            onProceed={() => { setRateLimitWarning(false); startScan(); }}
            onCancel={() => setRateLimitWarning(false)}
          />
        )}

        {showCrossOrgSearch && (
          <CrossOrgSearch onClose={() => setShowCrossOrgSearch(false)} />
        )}

        {/* Toolbar */}
        <div className="flex items-center justify-between gap-3">
          {/* Left: Org selector with add button */}
          <div className="flex items-center gap-2">
            <div className="relative">
              <label htmlFor="org-select" className="sr-only">Select organization</label>
              <select
                id="org-select"
                value={selectedOrgId}
                onChange={(e) => setSelectedOrgId(e.target.value)}
                className="appearance-none rounded-lg border border-border-default bg-surface-1 pl-3 pr-8 py-2 text-sm text-text-primary transition-colors hover:border-border-hover focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/20 min-w-[180px]"
                aria-label="Select organization"
              >
                <option value="">Select organization...</option>
                {orgs.map((org) => (
                  <option key={org.id} value={org.id}>
                    {org.name}
                  </option>
                ))}
              </select>
              <svg className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-text-quaternary" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>

            <button
              onClick={() => setShowAddOrg(!showAddOrg)}
              className={`rounded-lg p-2 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 ${
                showAddOrg 
                  ? "bg-accent text-white" 
                  : "border border-dashed border-border-hover text-text-tertiary hover:border-accent/40 hover:text-accent hover:bg-accent-subtle"
              }`}
              aria-expanded={showAddOrg}
              aria-label="Add organization"
              title="Add organization"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path d="M12 5v14M5 12h14" strokeLinecap="round"/>
              </svg>
            </button>
          </div>

          {/* Right: Actions menu */}
          <ActionsMenu
            showExport={results.length > 0 && plan === "pro"}
            showShare={results.length > 0 && scanId !== null && scanStatus === "completed"}
            showDelete={!!selectedOrgId}
            shareToken={shareToken}
            shareLoading={shareLoading}
            onExport={exportCSV}
            onShare={generateShareLink}
            onRevokeShare={revokeShareLink}
            onDelete={requestDeleteOrg}
            orgName={orgName}
          />
        </div>

        {/* Add Organization Panel */}
        {showAddOrg && (
          <div className="animate-fade-in-up rounded-xl border border-accent/20 bg-gradient-to-b from-accent-subtle/50 to-surface-1 overflow-hidden">
            <div className="px-5 py-4 border-b border-border-subtle bg-surface-1/50">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <h2 className="text-sm font-semibold flex items-center gap-2">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-accent" aria-hidden="true">
                      <path d="M19 21v-2a4 4 0 00-4-4H9a4 4 0 00-4 4v2M16 7a4 4 0 11-8 0 4 4 0 018 0z" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    Connect an Organization
                  </h2>
                  <p className="text-xs text-text-tertiary">
                    Add any GitHub organization — public or private (if you have access)
                  </p>
                </div>
                <button
                  onClick={() => setShowAddOrg(false)}
                  className="text-text-quaternary hover:text-text-secondary transition-colors rounded-lg p-1.5 hover:bg-surface-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 shrink-0"
                  aria-label="Close"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                    <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round"/>
                  </svg>
                </button>
              </div>
            </div>
            
            <div className="p-5 space-y-5">
              {/* Manual input */}
              <div className="space-y-2">
                <label htmlFor="org-name-input" className="text-xs font-medium text-text-secondary">
                  Organization name
                </label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-quaternary text-sm">github.com/</span>
                    <input
                      id="org-name-input"
                      type="text"
                      value={manualOrgName}
                      onChange={(e) => setManualOrgName(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && addOrgByName()}
                      placeholder="organization-name"
                      className="w-full rounded-lg border border-border-default bg-surface-0 pl-[5.5rem] pr-3 py-2.5 text-sm placeholder-text-quaternary transition-colors focus:outline-none focus:border-accent/50 focus:ring-2 focus:ring-accent/20"
                      autoFocus
                    />
                  </div>
                  <button
                    onClick={addOrgByName}
                    disabled={orgLoading || !manualOrgName.trim()}
                    className="rounded-lg bg-accent px-5 py-2.5 text-sm font-medium text-white transition-all hover:bg-accent-hover disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 whitespace-nowrap"
                  >
                    {orgLoading ? (
                      <span className="inline-flex items-center gap-2">
                        <svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                        </svg>
                        Adding...
                      </span>
                    ) : (
                      "Connect"
                    )}
                  </button>
                </div>
              </div>

              {/* Quick picks */}
              {availableOrgs.filter((o) => !o.connected).length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="h-px flex-1 bg-border-subtle" />
                    <span className="text-xs font-medium text-text-quaternary uppercase tracking-wider">Your Organizations</span>
                    <div className="h-px flex-1 bg-border-subtle" />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {availableOrgs
                      .filter((o) => !o.connected)
                      .map((org) => (
                        <button
                          key={org.id}
                          onClick={() => connectOrg(org)}
                          disabled={orgLoading}
                          className="group inline-flex items-center gap-2 rounded-lg border border-border-default bg-surface-0 px-3 py-2 text-sm transition-all hover:border-accent/40 hover:bg-accent-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 disabled:opacity-50"
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-text-quaternary group-hover:text-accent transition-colors" aria-hidden="true">
                            <path d="M19 21v-2a4 4 0 00-4-4H9a4 4 0 00-4 4v2M16 7a4 4 0 11-8 0 4 4 0 018 0z" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                          <span className="text-text-secondary group-hover:text-accent transition-colors">{org.login}</span>
                        </button>
                      ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {resultsLoading && !results.length ? (
          <div className="space-y-6 animate-fade-in">
            <StatsSkeleton />
            <OrgStatsSkeleton />
            <TableSkeleton />
          </div>
        ) : (
          <Tabs defaultTab="overview" onTabChange={(_tab, setTab) => { setActiveTabRef.current = setTab; }}>
            <TabList className="mb-6">
              <TabTrigger 
                value="overview"
                icon={
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                }
              >
                Overview
              </TabTrigger>
              <TabTrigger 
                value="repositories"
                badge={results.length > 0 ? severeCount : undefined}
                icon={
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                }
              >
                Repositories
              </TabTrigger>
              <TabTrigger 
                value="history"
                badge={scanHistory.length > 0 ? scanHistory.length : undefined}
                icon={
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                }
              >
                History
              </TabTrigger>
            </TabList>

            <TabContent value="overview">
              <OverviewTab
                results={results}
                orgStats={orgStats}
                orgStatsLoading={orgStatsLoading}
                lastScanTime={lastScanTime}
                scanStatusInfo={scanStatusInfo}
                isScanning={isScanning}
                onStartScan={selectedOrgId && !isScanning ? startScan : undefined}
                relativeTime={relativeTime}
              />
            </TabContent>

            <TabContent value="repositories">
              <RepositoriesTab
                results={results}
                selectedResult={selectedResult}
                onSelectResult={setSelectedResult}
                selectedRows={selectedRows}
                onToggleRow={toggleRowSelection}
                onSelectAll={selectAllRows}
                orgName={orgName ?? ""}
                previousScores={previousScores}
                resultsLoading={resultsLoading}
                isScanning={isScanning}
                onStartScan={selectedOrgId && !isScanning ? startScan : undefined}
                onExportSelected={exportSubsetCSV}
              />
            </TabContent>

            <TabContent value="history">
              <HistoryTab
                scanHistory={scanHistory}
                scanHistoryLoading={scanHistoryLoading}
                currentScanId={scanId}
                onSelectScan={loadHistoricalScan}
                completedScans={completedScans}
                scanDiff={scanDiff}
                onLoadDiff={loadScanDiff}
                onCloseDiff={() => setScanDiff(null)}
                relativeTime={relativeTime}
              />
            </TabContent>
          </Tabs>
        )}

        <footer className="flex items-center justify-center gap-4 py-4 text-xs text-text-quaternary" role="contentinfo">
          <span title="Press / to focus search">
            <kbd className="px-1.5 py-0.5 rounded border border-border-default bg-surface-2 font-mono">/</kbd> Search
          </span>
          <span title="Press Escape to close panel">
            <kbd className="px-1.5 py-0.5 rounded border border-border-default bg-surface-2 font-mono">Esc</kbd> Close
          </span>
          <span title="Press Ctrl+Shift+L to toggle theme">
            <kbd className="px-1.5 py-0.5 rounded border border-border-default bg-surface-2 font-mono">⌃⇧L</kbd> Theme
          </span>
        </footer>
      </div>

      <ConfirmModal
        open={!!deleteModalOrg}
        title={`Delete "${deleteModalOrg?.name}"?`}
        description="This will permanently delete the organization and all its scan history. This action cannot be undone."
        confirmLabel="Delete Organization"
        variant="danger"
        onConfirm={confirmDeleteOrg}
        onCancel={() => setDeleteModalOrg(null)}
      />
    </div>
  );
}
