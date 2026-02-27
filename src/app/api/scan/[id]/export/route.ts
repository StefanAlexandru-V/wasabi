import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthenticatedUser, getUserPlan, unauthorized, serverError, badRequest, validateUUID } from "@/lib/api-utils";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) return unauthorized();

    const plan = await getUserPlan(user.id);
    if (plan !== "pro") {
      return NextResponse.json(
        { error: "CSV export requires Pro plan" },
        { status: 403 }
      );
    }

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

    const headers = [
      "Rank",
      "Repo Name",
      "Rot Score",
      "Severity",
      "Last Commit",
      "Archived",
    ];

    function escapeCsvField(value: string | number): string {
      const str = String(value);
      if (str.includes(",") || str.includes('"') || str.includes("\n")) {
        return '"' + str.replace(/"/g, '""') + '"';
      }
      return str;
    }

    const rows = scan.scores.map((score, index) => [
      index + 1,
      score.repo.name,
      score.scoreTotal,
      score.severity,
      score.repo.pushedAt?.toISOString() ?? "N/A",
      score.repo.archived ? "Yes" : "No",
    ]);

    const csv = [headers.join(","), ...rows.map((r) => r.map(escapeCsvField).join(","))].join("\n");

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="scan-${id}.csv"`,
      },
    });
  } catch (e) {
    console.error("GET /api/scan/:id/export error:", e instanceof Error ? e.message : "Unknown error");
    return serverError();
  }
}
