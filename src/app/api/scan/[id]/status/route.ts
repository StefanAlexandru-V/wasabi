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
      select: {
        id: true,
        status: true,
        startedAt: true,
        completedAt: true,
        repoCount: true,
        totalRepoCount: true,
        processedRepoCount: true,
      },
    });

    if (!scan) {
      return NextResponse.json({ error: "Scan not found" }, { status: 404 });
    }

    return NextResponse.json(scan);
  } catch (e) {
    console.error("GET /api/scan/:id/status error:", e instanceof Error ? e.message : "Unknown error");
    return serverError();
  }
}
