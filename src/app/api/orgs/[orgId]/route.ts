import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthenticatedUser, unauthorized, serverError, badRequest, validateUUID } from "@/lib/api-utils";

export async function DELETE(
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

    await prisma.organization.delete({
      where: { id: orgId },
    });

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("DELETE /api/orgs/:orgId error:", e instanceof Error ? e.message : "Unknown error");
    return serverError();
  }
}
