import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  getAuthenticatedUser,
  unauthorized,
  serverError,
  badRequest,
  validateUUID,
} from "@/lib/api-utils";

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

    const scans = await prisma.scan.findMany({
      where: { orgId, org: { ownerUserId: user.id } },
      orderBy: { startedAt: "desc" },
      take: 20,
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

    return NextResponse.json({ scans });
  } catch (e) {
    console.error(
      "GET /api/orgs/:orgId/scans error:",
      e instanceof Error ? e.message : "Unknown error"
    );
    return serverError();
  }
}
