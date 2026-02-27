import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  getAuthenticatedUser,
  unauthorized,
  serverError,
} from "@/lib/api-utils";

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) return unauthorized();

    const url = new URL(req.url);
    const q = (url.searchParams.get("q") ?? "").trim().toLowerCase();
    const severity = url.searchParams.get("severity");
    const minScore = url.searchParams.get("minScore");

    const orgs = await prisma.organization.findMany({
      where: { ownerUserId: user.id },
      select: { id: true, name: true },
    });

    if (orgs.length === 0) {
      return NextResponse.json({ results: [] });
    }

    const orgIds = orgs.map((o) => o.id);
    const orgMap = new Map(orgs.map((o) => [o.id, o.name]));

    const latestScans = await prisma.scan.findMany({
      where: {
        orgId: { in: orgIds },
        status: "completed",
      },
      orderBy: { completedAt: "desc" },
      distinct: ["orgId"],
      select: { id: true, orgId: true },
    });

    if (latestScans.length === 0) {
      return NextResponse.json({ results: [] });
    }

    const scanIds = latestScans.map((s) => s.id);
    const scanOrgMap = new Map(latestScans.map((s) => [s.id, s.orgId]));

    const where: Record<string, unknown> = {
      scanId: { in: scanIds },
    };

    if (severity && ["low", "high", "severe"].includes(severity)) {
      where.severity = severity;
    }

    if (minScore) {
      const min = parseInt(minScore, 10);
      if (!isNaN(min)) {
        where.scoreTotal = { gte: min };
      }
    }

    const scores = await prisma.repoScore.findMany({
      where,
      include: {
        repo: { select: { name: true, archived: true, pushedAt: true } },
      },
      orderBy: { scoreTotal: "desc" },
      take: 200,
    });

    let results = scores.map((s) => {
      const orgId = scanOrgMap.get(s.scanId) ?? "";
      return {
        repoName: s.repo.name,
        orgName: orgMap.get(orgId) ?? "",
        orgId,
        rotScore: s.scoreTotal,
        severity: s.severity,
        lastCommit: s.repo.pushedAt,
        archived: s.repo.archived,
        scoreBreakdown: s.scoreBreakdown,
      };
    });

    if (q) {
      results = results.filter(
        (r) => r.repoName.toLowerCase().includes(q) || r.orgName.toLowerCase().includes(q)
      );
    }

    return NextResponse.json({ results });
  } catch (e) {
    console.error("GET /api/repos/search error:", e instanceof Error ? e.message : "Unknown error");
    return serverError();
  }
}
