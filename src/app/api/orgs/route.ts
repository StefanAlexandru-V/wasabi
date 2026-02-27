import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthenticatedUser, getAccessToken, unauthorized, serverError } from "@/lib/api-utils";
import { fetchUserOrgs } from "@/lib/github";

export async function GET() {
  try {
    const user = await getAuthenticatedUser();
    if (!user) return unauthorized();

    const token = await getAccessToken(user.id);
    if (!token) {
      return NextResponse.json({ error: "No GitHub token found" }, { status: 400 });
    }

    const [githubOrgs, connectedOrgs] = await Promise.all([
      fetchUserOrgs(token).catch(() => []),
      prisma.organization.findMany({
        where: { ownerUserId: user.id },
      }),
    ]);

    const connectedIds = new Set(connectedOrgs.map((o) => o.githubOrgId));

    return NextResponse.json({
      available: githubOrgs.map((o) => ({
        ...o,
        connected: connectedIds.has(o.id),
      })),
      connected: connectedOrgs,
    });
  } catch (e) {
    console.error("GET /api/orgs error:", e instanceof Error ? e.message : "Unknown error");
    return serverError();
  }
}
