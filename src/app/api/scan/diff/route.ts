import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  getAuthenticatedUser,
  unauthorized,
  serverError,
  badRequest,
  validateUUID,
} from "@/lib/api-utils";

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) return unauthorized();

    const url = new URL(req.url);
    const scanAId = url.searchParams.get("scanA");
    const scanBId = url.searchParams.get("scanB");

    if (!scanAId || !scanBId) {
      return badRequest("Both scanA and scanB query params required");
    }

    const validA = validateUUID(scanAId);
    const validB = validateUUID(scanBId);
    if (!validA || !validB) return badRequest("Invalid scan ID format");

    const [scanA, scanB] = await Promise.all([
      prisma.scan.findFirst({
        where: { id: validA, org: { ownerUserId: user.id }, status: "completed" },
        include: {
          scores: {
            include: { repo: { select: { name: true } } },
            orderBy: { scoreTotal: "desc" },
          },
        },
      }),
      prisma.scan.findFirst({
        where: { id: validB, org: { ownerUserId: user.id }, status: "completed" },
        include: {
          scores: {
            include: { repo: { select: { name: true } } },
            orderBy: { scoreTotal: "desc" },
          },
        },
      }),
    ]);

    if (!scanA || !scanB) {
      return NextResponse.json({ error: "One or both scans not found" }, { status: 404 });
    }

    const scoresA = new Map(
      scanA.scores.map((s) => [s.repo.name, { score: s.scoreTotal, severity: s.severity, breakdown: s.scoreBreakdown as Record<string, number> }])
    );
    const scoresB = new Map(
      scanB.scores.map((s) => [s.repo.name, { score: s.scoreTotal, severity: s.severity, breakdown: s.scoreBreakdown as Record<string, number> }])
    );

    const allRepos = new Set([...scoresA.keys(), ...scoresB.keys()]);

    const diff = Array.from(allRepos).map((repoName) => {
      const a = scoresA.get(repoName);
      const b = scoresB.get(repoName);
      return {
        repoName,
        scoreA: a?.score ?? null,
        scoreB: b?.score ?? null,
        delta: (b?.score ?? 0) - (a?.score ?? 0),
        severityA: a?.severity ?? null,
        severityB: b?.severity ?? null,
        breakdownA: a?.breakdown ?? null,
        breakdownB: b?.breakdown ?? null,
        status: !a ? "added" : !b ? "removed" : a.score === b.score ? "unchanged" : a.score < b.score ? "worsened" : "improved",
      };
    }).sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));

    const improved = diff.filter((d) => d.status === "improved").length;
    const worsened = diff.filter((d) => d.status === "worsened").length;
    const unchanged = diff.filter((d) => d.status === "unchanged").length;
    const added = diff.filter((d) => d.status === "added").length;
    const removed = diff.filter((d) => d.status === "removed").length;

    return NextResponse.json({
      scanA: { id: scanA.id, startedAt: scanA.startedAt, completedAt: scanA.completedAt, repoCount: scanA.repoCount },
      scanB: { id: scanB.id, startedAt: scanB.startedAt, completedAt: scanB.completedAt, repoCount: scanB.repoCount },
      summary: { improved, worsened, unchanged, added, removed },
      diff,
    });
  } catch (e) {
    console.error("GET /api/scan/diff error:", e instanceof Error ? e.message : "Unknown error");
    return serverError();
  }
}
