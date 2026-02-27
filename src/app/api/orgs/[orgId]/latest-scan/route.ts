import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthenticatedUser, unauthorized, serverError, badRequest, validateUUID } from "@/lib/api-utils";

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

    const activeScan = await prisma.scan.findFirst({
      where: {
        orgId,
        org: { ownerUserId: user.id },
        status: { in: ["queued", "running"] },
      },
      orderBy: { startedAt: "desc" },
    });

    if (activeScan) {
      const lastCompleted = await prisma.scan.findFirst({
        where: {
          orgId,
          org: { ownerUserId: user.id },
          status: "completed",
        },
        orderBy: { completedAt: "desc" },
        include: {
          scores: {
            include: { repo: true },
            orderBy: { scoreTotal: "desc" },
          },
        },
      });

      const results = (lastCompleted?.scores ?? []).map((score, index) => ({
        rank: index + 1,
        repoName: score.repo.name,
        rotScore: score.scoreTotal,
        severity: score.severity,
        lastCommit: score.repo.pushedAt,
        scoreBreakdown: score.scoreBreakdown,
        archived: score.repo.archived,
      }));

      return NextResponse.json({
        scan: {
          id: activeScan.id,
          status: activeScan.status,
          startedAt: activeScan.startedAt,
          completedAt: null,
          repoCount: activeScan.repoCount,
          totalRepoCount: activeScan.totalRepoCount,
          processedRepoCount: activeScan.processedRepoCount,
        },
        results,
      });
    }

    const scan = await prisma.scan.findFirst({
      where: {
        orgId,
        org: { ownerUserId: user.id },
        status: "completed",
      },
      orderBy: { completedAt: "desc" },
      include: {
        scores: {
          include: { repo: true },
          orderBy: { scoreTotal: "desc" },
        },
      },
    });

    if (!scan) {
      return NextResponse.json({ scan: null, results: [] });
    }

    const results = scan.scores.map((score, index) => ({
      rank: index + 1,
      repoName: score.repo.name,
      rotScore: score.scoreTotal,
      severity: score.severity,
      lastCommit: score.repo.pushedAt,
      scoreBreakdown: score.scoreBreakdown,
      archived: score.repo.archived,
    }));

    return NextResponse.json({
      scan: {
        id: scan.id,
        status: scan.status,
        startedAt: scan.startedAt,
        completedAt: scan.completedAt,
        repoCount: scan.repoCount,
      },
      results,
    });
  } catch (e) {
    console.error("GET /api/orgs/:orgId/latest-scan error:", e instanceof Error ? e.message : "Unknown error");
    return serverError();
  }
}
