import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { randomBytes } from "crypto";
import {
  getAuthenticatedUser,
  unauthorized,
  serverError,
  badRequest,
  validateUUID,
} from "@/lib/api-utils";

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
      where: { id, org: { ownerUserId: user.id }, status: "completed" },
    });

    if (!scan) {
      return NextResponse.json({ error: "Scan not found" }, { status: 404 });
    }

    if (scan.shareToken) {
      return NextResponse.json({ shareToken: scan.shareToken });
    }

    const token = randomBytes(24).toString("base64url");

    await prisma.scan.update({
      where: { id },
      data: { shareToken: token },
    });

    return NextResponse.json({ shareToken: token });
  } catch (e) {
    console.error("POST /api/scan/:id/share error:", e instanceof Error ? e.message : "Unknown error");
    return serverError();
  }
}

export async function DELETE(
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
    });

    if (!scan) {
      return NextResponse.json({ error: "Scan not found" }, { status: 404 });
    }

    await prisma.scan.update({
      where: { id },
      data: { shareToken: null },
    });

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("DELETE /api/scan/:id/share error:", e instanceof Error ? e.message : "Unknown error");
    return serverError();
  }
}
