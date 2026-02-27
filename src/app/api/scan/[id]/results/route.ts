import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthenticatedUser, unauthorized, serverError, badRequest, validateUUID } from "@/lib/api-utils";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) return unauthorized();

    const { id: rawId } = await params;
    const id = validateUUID(rawId);
    if (!id) return badRequest("Invalid scan ID");

    const scan = await prisma.scan.findFirst({
      where: {
        id,
        org: { ownerUserId: user.id },
      },
      include: {
        scores: {
          include: { repo: true },
          orderBy: { scoreTotal: "desc" },
        },
      },
    });

    if (!scan) {
      return NextResponse.json({ error: "Scan not found" }, { status: 404 });
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
    console.error("GET /api/scan/:id/results error:", e instanceof Error ? e.message : "Unknown error");
    return serverError();
  }
}
