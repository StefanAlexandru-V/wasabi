export interface ScoreBreakdown {
  inactivity: number;
  criticalVulnerabilities: number;
  missingCodeowners: number;
  noBranchProtection: number;
  stalePRs: number;
  noCI: number;
  notArchivedButInactive: number;
}

export interface RepoMetrics {
  lastPushedAt: Date | null;
  archived: boolean;
  criticalVulnCount: number;
  hasCodeowners: boolean;
  hasBranchProtection: boolean;
  stalePRCount: number;
  hasCI: boolean;
}

export function computeRotScore(metrics: RepoMetrics): {
  scoreTotal: number;
  scoreBreakdown: ScoreBreakdown;
  severity: "low" | "high" | "severe";
} {
  const breakdown: ScoreBreakdown = {
    inactivity: 0,
    criticalVulnerabilities: 0,
    missingCodeowners: 0,
    noBranchProtection: 0,
    stalePRs: 0,
    noCI: 0,
    notArchivedButInactive: 0,
  };

  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

  const isInactive =
    !metrics.lastPushedAt || metrics.lastPushedAt < sixMonthsAgo;

  if (isInactive) {
    breakdown.inactivity = 3;
  }

  if (metrics.criticalVulnCount > 0) {
    breakdown.criticalVulnerabilities = 4;
  }

  if (!metrics.hasCodeowners) {
    breakdown.missingCodeowners = 2;
  }

  if (!metrics.hasBranchProtection) {
    breakdown.noBranchProtection = 2;
  }

  if (metrics.stalePRCount > 5) {
    breakdown.stalePRs = 2;
  }

  if (!metrics.hasCI) {
    breakdown.noCI = 1;
  }

  if (!metrics.archived && isInactive) {
    breakdown.notArchivedButInactive = 3;
  }

  const scoreTotal = Object.values(breakdown).reduce((a, b) => a + b, 0);

  let severity: "low" | "high" | "severe";
  if (scoreTotal >= 10) {
    severity = "severe";
  } else if (scoreTotal >= 7) {
    severity = "high";
  } else {
    severity = "low";
  }

  return { scoreTotal, scoreBreakdown: breakdown, severity };
}
