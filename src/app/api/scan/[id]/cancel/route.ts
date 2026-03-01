import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthenticatedUser, unauthorized, badRequest, serverError, validateUUID } from "@/lib/api-utils";

export async function POST(
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
      where: { id, org: { ownerUserId: user.id } },
      select: { id: true, status: true },
    });

    if (!scan) {
      return NextResponse.json({ error: "Scan not found" }, { status: 404 });
    }

    if (scan.status !== "running" && scan.status !== "queued") {
      return badRequest(`Cannot cancel scan with status '${scan.status}'`);
    }

    await prisma.scan.update({
      where: { id },
      data: { status: "cancelled", completedAt: new Date() },
    });

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("Cancel scan error:", e);
    return serverError("Failed to cancel scan");
  }
}
