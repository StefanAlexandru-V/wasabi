// Shared types for dashboard components

export interface ScanResult {
  rank: number;
  repoName: string;
  rotScore: number;
  severity: string;
  lastCommit: string | null;
  scoreBreakdown: Record<string, number>;
  archived: boolean;
}

export interface Org {
  id: string;
  name: string;
  githubOrgId: string;
  scans?: { id: string; status: string }[];
}

export interface GithubOrg {
  id: string;
  login: string;
  avatar_url: string;
  connected: boolean;
}

export interface RateLimitInfo {
  remaining: number;
  limit: number;
  resetsAt: string;
}

export interface ScanStatusInfo {
  status: string;
  startedAt: string;
  totalRepoCount: number;
  processedRepoCount: number;
}

export interface ScanHistoryItem {
  id: string;
  status: string;
  startedAt: string;
  completedAt: string | null;
  repoCount: number;
}

export interface OrgStats {
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

export interface ScanDiff {
  scanA: { id: string; startedAt: string; completedAt: string | null; repoCount: number };
  scanB: { id: string; startedAt: string; completedAt: string | null; repoCount: number };
  summary: { improved: number; worsened: number; unchanged: number; added: number; removed: number };
  diff: { 
    repoName: string; 
    scoreA: number | null; 
    scoreB: number | null; 
    delta: number; 
    severityA: string | null; 
    severityB: string | null; 
    status: string;
  }[];
}

export interface CrossOrgResult {
  repoName: string;
  orgName: string;
  orgId: string;
  rotScore: number;
  severity: string;
  lastCommit: string | null;
  archived: boolean;
  scoreBreakdown: Record<string, number>;
}

export const factorLabels: Record<string, string> = {
  inactivity: "Inactivity",
  criticalVulnerabilities: "Critical Vulns",
  missingCodeowners: "Missing CODEOWNERS",
  noBranchProtection: "No Branch Protection",
  stalePRs: "Stale PRs",
  noCI: "No CI",
  notArchivedButInactive: "Inactive & Not Archived",
};

export type QualityGateStatus = "pass" | "fail" | "unknown";

export function computeQualityGate(results: ScanResult[]): { status: QualityGateStatus; reason: string } {
  if (results.length === 0) {
    return { status: "unknown", reason: "No scan data" };
  }

  const severeCount = results.filter(r => r.severity === "severe").length;
  const highCount = results.filter(r => r.severity === "high").length;
  const avgScore = results.reduce((sum, r) => sum + r.rotScore, 0) / results.length;

  if (severeCount > 0) {
    return { 
      status: "fail", 
      reason: `${severeCount} severe ${severeCount === 1 ? "repo" : "repos"} need attention` 
    };
  }

  if (highCount > results.length * 0.2) {
    return { 
      status: "fail", 
      reason: `${highCount} high-risk repos (>${Math.round(results.length * 0.2)} threshold)` 
    };
  }

  if (avgScore > 6) {
    return { 
      status: "fail", 
      reason: `Average score ${avgScore.toFixed(1)} exceeds threshold of 6` 
    };
  }

  return { 
    status: "pass", 
    reason: "All quality gates passed" 
  };
}
