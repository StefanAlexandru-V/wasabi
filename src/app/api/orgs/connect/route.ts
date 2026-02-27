import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthenticatedUser, getUserPlan, getAccessToken, unauthorized, badRequest, serverError } from "@/lib/api-utils";
import { createRestClient } from "@/lib/github";
import { z } from "zod";

const connectOrgSchema = z.object({
  name: z.string().min(1, "name is required").max(100).regex(/^[a-zA-Z0-9_.-]+$/, "Invalid organization name"),
  githubOrgId: z.string().max(20).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) return unauthorized();

    const body = await req.json().catch(() => null);
    if (!body) return badRequest("Invalid JSON body");

    const parsed = connectOrgSchema.safeParse(body);
    if (!parsed.success) {
      return badRequest(parsed.error.issues[0]?.message ?? "Invalid input");
    }

    let { githubOrgId } = parsed.data;
    const { name } = parsed.data;

    if (!githubOrgId) {
      const token = await getAccessToken(user.id);
      if (!token) {
        return NextResponse.json({ error: "No GitHub token found" }, { status: 400 });
      }

      const octokit = createRestClient(token);
      try {
        const { data: ghOrg } = await octokit.orgs.get({ org: name });
        githubOrgId = String(ghOrg.id);
      } catch {
        return NextResponse.json(
          { error: `Organization "${name}" not found on GitHub` },
          { status: 404 }
        );
      }
    }

    const plan = await getUserPlan(user.id);
    if (plan === "free") {
      const existingCount = await prisma.organization.count({
        where: { ownerUserId: user.id },
      });
      if (existingCount >= 1) {
        return NextResponse.json(
          { error: "Free plan allows only 1 organization. Upgrade to Pro." },
          { status: 403 }
        );
      }
    }

    const org = await prisma.organization.upsert({
      where: {
        githubOrgId_ownerUserId: {
          githubOrgId: String(githubOrgId),
          ownerUserId: user.id,
        },
      },
      update: { name },
      create: {
        githubOrgId: String(githubOrgId),
        name,
        ownerUserId: user.id,
      },
    });

    return NextResponse.json(org);
  } catch (e) {
    console.error("POST /api/orgs/connect error:", e instanceof Error ? e.message : "Unknown error");
    return serverError();
  }
}
