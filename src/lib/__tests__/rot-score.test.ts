import { describe, it, expect, vi, beforeEach } from "vitest";
import { computeRotScore, RepoMetrics } from "@/lib/rot-score";

function makeMetrics(overrides: Partial<RepoMetrics> = {}): RepoMetrics {
  return {
    lastPushedAt: new Date(),
    archived: false,
    criticalVulnCount: 0,
    hasCodeowners: true,
    hasBranchProtection: true,
    stalePRCount: 0,
    hasCI: true,
    ...overrides,
  };
}

function monthsAgo(n: number): Date {
  const d = new Date();
  d.setMonth(d.getMonth() - n);
  return d;
}

describe("computeRotScore", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-06-15T12:00:00Z"));
  });

  describe("clean repo (all green)", () => {
    it("returns score 0 and severity low", () => {
      const result = computeRotScore(makeMetrics());
      expect(result.scoreTotal).toBe(0);
      expect(result.severity).toBe("low");
      expect(result.scoreBreakdown).toEqual({
        inactivity: 0,
        criticalVulnerabilities: 0,
        missingCodeowners: 0,
        noBranchProtection: 0,
        stalePRs: 0,
        noCI: 0,
        notArchivedButInactive: 0,
      });
    });
  });

  describe("inactivity (+3)", () => {
    it("scores 3 when last push > 6 months ago", () => {
      const result = computeRotScore(
        makeMetrics({ lastPushedAt: monthsAgo(7) })
      );
      expect(result.scoreBreakdown.inactivity).toBe(3);
    });

    it("scores 0 when last push < 6 months ago", () => {
      const result = computeRotScore(
        makeMetrics({ lastPushedAt: monthsAgo(5) })
      );
      expect(result.scoreBreakdown.inactivity).toBe(0);
    });

    it("scores 3 when lastPushedAt is null", () => {
      const result = computeRotScore(
        makeMetrics({ lastPushedAt: null })
      );
      expect(result.scoreBreakdown.inactivity).toBe(3);
    });

    it("scores 3 when last push is exactly 6 months ago", () => {
      const result = computeRotScore(
        makeMetrics({ lastPushedAt: monthsAgo(6) })
      );
      expect(result.scoreBreakdown.inactivity).toBe(0);
    });
  });

  describe("critical vulnerabilities (+4)", () => {
    it("scores 4 when criticalVulnCount > 0", () => {
      const result = computeRotScore(makeMetrics({ criticalVulnCount: 1 }));
      expect(result.scoreBreakdown.criticalVulnerabilities).toBe(4);
    });

    it("scores 0 when criticalVulnCount is 0", () => {
      const result = computeRotScore(makeMetrics({ criticalVulnCount: 0 }));
      expect(result.scoreBreakdown.criticalVulnerabilities).toBe(0);
    });

    it("scores 4 when criticalVulnCount is very high", () => {
      const result = computeRotScore(makeMetrics({ criticalVulnCount: 100 }));
      expect(result.scoreBreakdown.criticalVulnerabilities).toBe(4);
    });
  });

  describe("missing CODEOWNERS (+2)", () => {
    it("scores 2 when hasCodeowners is false", () => {
      const result = computeRotScore(makeMetrics({ hasCodeowners: false }));
      expect(result.scoreBreakdown.missingCodeowners).toBe(2);
    });

    it("scores 0 when hasCodeowners is true", () => {
      const result = computeRotScore(makeMetrics({ hasCodeowners: true }));
      expect(result.scoreBreakdown.missingCodeowners).toBe(0);
    });
  });

  describe("no branch protection (+2)", () => {
    it("scores 2 when hasBranchProtection is false", () => {
      const result = computeRotScore(
        makeMetrics({ hasBranchProtection: false })
      );
      expect(result.scoreBreakdown.noBranchProtection).toBe(2);
    });

    it("scores 0 when hasBranchProtection is true", () => {
      const result = computeRotScore(
        makeMetrics({ hasBranchProtection: true })
      );
      expect(result.scoreBreakdown.noBranchProtection).toBe(0);
    });
  });

  describe("stale PRs (+2)", () => {
    it("scores 2 when stalePRCount > 5", () => {
      const result = computeRotScore(makeMetrics({ stalePRCount: 6 }));
      expect(result.scoreBreakdown.stalePRs).toBe(2);
    });

    it("scores 0 when stalePRCount is exactly 5", () => {
      const result = computeRotScore(makeMetrics({ stalePRCount: 5 }));
      expect(result.scoreBreakdown.stalePRs).toBe(0);
    });

    it("scores 0 when stalePRCount is 0", () => {
      const result = computeRotScore(makeMetrics({ stalePRCount: 0 }));
      expect(result.scoreBreakdown.stalePRs).toBe(0);
    });
  });

  describe("no CI (+1)", () => {
    it("scores 1 when hasCI is false", () => {
      const result = computeRotScore(makeMetrics({ hasCI: false }));
      expect(result.scoreBreakdown.noCI).toBe(1);
    });

    it("scores 0 when hasCI is true", () => {
      const result = computeRotScore(makeMetrics({ hasCI: true }));
      expect(result.scoreBreakdown.noCI).toBe(0);
    });
  });

  describe("not archived but inactive (+3)", () => {
    it("scores 3 when not archived AND inactive", () => {
      const result = computeRotScore(
        makeMetrics({ archived: false, lastPushedAt: monthsAgo(7) })
      );
      expect(result.scoreBreakdown.notArchivedButInactive).toBe(3);
    });

    it("scores 0 when archived AND inactive", () => {
      const result = computeRotScore(
        makeMetrics({ archived: true, lastPushedAt: monthsAgo(7) })
      );
      expect(result.scoreBreakdown.notArchivedButInactive).toBe(0);
    });

    it("scores 0 when not archived AND active", () => {
      const result = computeRotScore(
        makeMetrics({ archived: false, lastPushedAt: new Date() })
      );
      expect(result.scoreBreakdown.notArchivedButInactive).toBe(0);
    });
  });

  describe("severity thresholds", () => {
    it("returns low when score is 6", () => {
      const result = computeRotScore(
        makeMetrics({
          criticalVulnCount: 1,
          hasCodeowners: false,
        })
      );
      expect(result.scoreTotal).toBe(6);
      expect(result.severity).toBe("low");
    });

    it("returns high when score is 7", () => {
      const result = computeRotScore(
        makeMetrics({
          criticalVulnCount: 1,
          hasCodeowners: false,
          hasCI: false,
        })
      );
      expect(result.scoreTotal).toBe(7);
      expect(result.severity).toBe("high");
    });

    it("returns high when score is 9", () => {
      const result = computeRotScore(
        makeMetrics({
          criticalVulnCount: 1,
          hasCodeowners: false,
          hasBranchProtection: false,
          hasCI: false,
        })
      );
      expect(result.scoreTotal).toBe(9);
      expect(result.severity).toBe("high");
    });

    it("returns severe when score is 10", () => {
      const result = computeRotScore(
        makeMetrics({
          criticalVulnCount: 1,
          hasCodeowners: false,
          hasBranchProtection: false,
          stalePRCount: 6,
        })
      );
      expect(result.scoreTotal).toBe(10);
      expect(result.severity).toBe("severe");
    });
  });

  describe("worst case (all factors)", () => {
    it("returns max score 17 and severe", () => {
      const result = computeRotScore(
        makeMetrics({
          lastPushedAt: monthsAgo(12),
          archived: false,
          criticalVulnCount: 5,
          hasCodeowners: false,
          hasBranchProtection: false,
          stalePRCount: 10,
          hasCI: false,
        })
      );
      expect(result.scoreTotal).toBe(17);
      expect(result.severity).toBe("severe");
      expect(result.scoreBreakdown).toEqual({
        inactivity: 3,
        criticalVulnerabilities: 4,
        missingCodeowners: 2,
        noBranchProtection: 2,
        stalePRs: 2,
        noCI: 1,
        notArchivedButInactive: 3,
      });
    });
  });

  describe("total is sum of breakdown", () => {
    it("scoreTotal matches sum of all breakdown values", () => {
      const result = computeRotScore(
        makeMetrics({
          lastPushedAt: monthsAgo(8),
          archived: false,
          criticalVulnCount: 2,
          hasCodeowners: false,
          hasBranchProtection: true,
          stalePRCount: 3,
          hasCI: false,
        })
      );
      const sum = Object.values(result.scoreBreakdown).reduce(
        (a, b) => a + b,
        0
      );
      expect(result.scoreTotal).toBe(sum);
    });
  });
});
