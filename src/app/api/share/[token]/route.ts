import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;

    if (!token || token.length < 10) {
      return NextResponse.json({ error: "Invalid share token" }, { status: 400 });
    }

    const scan = await prisma.scan.findUnique({
      where: { shareToken: token },
      include: {
        org: { select: { name: true } },
        scores: {
          include: { repo: { select: { name: true, archived: true, pushedAt: true } } },
          orderBy: { scoreTotal: "desc" },
        },
      },
    });

    if (!scan) {
      return NextResponse.json({ error: "Report not found or link expired" }, { status: 404 });
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
      orgName: scan.org.name,
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
    console.error("GET /api/share/:token error:", e instanceof Error ? e.message : "Unknown error");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
