import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  getAuthenticatedUser,
  unauthorized,
  serverError,
  badRequest,
  validateUUID,
} from "@/lib/api-utils";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) return unauthorized();

    const { orgId: rawId } = await params;
    const orgId = validateUUID(rawId);
    if (!orgId) return badRequest("Invalid organization ID");

    const org = await prisma.organization.findFirst({
      where: { id: orgId, ownerUserId: user.id },
    });

    if (!org) {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    }

    const latestScan = await prisma.scan.findFirst({
      where: { orgId, status: "completed" },
      orderBy: { completedAt: "desc" },
      include: {
        scores: {
          select: {
            scoreTotal: true,
            severity: true,
            scoreBreakdown: true,
          },
        },
      },
    });

    if (!latestScan || latestScan.scores.length === 0) {
      return NextResponse.json({
        totalRepos: 0,
        avgScore: 0,
        severeCount: 0,
        highCount: 0,
        lowCount: 0,
        severePct: 0,
        topRotFactors: [],
        scoreDistribution: [],
      });
    }

    const scores = latestScan.scores;
    const totalRepos = scores.length;
    const avgScore = Math.round(
      scores.reduce((sum, s) => sum + s.scoreTotal, 0) / totalRepos
    );
    const severeCount = scores.filter((s) => s.severity === "severe").length;
    const highCount = scores.filter((s) => s.severity === "high").length;
    const lowCount = scores.filter((s) => s.severity === "low").length;
    const severePct = Math.round((severeCount / totalRepos) * 100);

    const factorTotals: Record<string, number> = {};
    for (const s of scores) {
      const breakdown = s.scoreBreakdown as Record<string, number>;
      for (const [key, value] of Object.entries(breakdown)) {
        if (value > 0) {
          factorTotals[key] = (factorTotals[key] ?? 0) + 1;
        }
      }
    }
    const topRotFactors = Object.entries(factorTotals)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([factor, count]) => ({ factor, count, pct: Math.round((count / totalRepos) * 100) }));

    const distribution = [
      { label: "0-3", count: scores.filter((s) => s.scoreTotal <= 3).length },
      { label: "4-6", count: scores.filter((s) => s.scoreTotal >= 4 && s.scoreTotal <= 6).length },
      { label: "7-9", count: scores.filter((s) => s.scoreTotal >= 7 && s.scoreTotal <= 9).length },
      { label: "10-13", count: scores.filter((s) => s.scoreTotal >= 10 && s.scoreTotal <= 13).length },
      { label: "14-17", count: scores.filter((s) => s.scoreTotal >= 14).length },
    ];

    const scanCount = await prisma.scan.count({
      where: { orgId, status: "completed" },
    });

    return NextResponse.json({
      totalRepos,
      avgScore,
      severeCount,
      highCount,
      lowCount,
      severePct,
      topRotFactors,
      scoreDistribution: distribution,
      totalScans: scanCount,
    });
  } catch (e) {
    console.error(
      "GET /api/orgs/:orgId/stats error:",
      e instanceof Error ? e.message : "Unknown error"
    );
    return serverError();
  }
}
