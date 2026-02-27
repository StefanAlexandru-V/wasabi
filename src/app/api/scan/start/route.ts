import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthenticatedUser, getUserPlan, unauthorized, badRequest, serverError } from "@/lib/api-utils";
import { inngest } from "@/inngest/client";
import { z } from "zod";

const scanStartSchema = z.object({
  orgId: z.string().uuid("Invalid orgId format"),
});

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) return unauthorized();

    const body = await req.json().catch(() => null);
    if (!body) return badRequest("Invalid JSON body");

    const parsed = scanStartSchema.safeParse(body);
    if (!parsed.success) {
      return badRequest(parsed.error.issues[0]?.message ?? "Invalid input");
    }

    const { orgId } = parsed.data;

    const org = await prisma.organization.findFirst({
      where: { id: orgId, ownerUserId: user.id },
    });

    if (!org) {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    }

    const plan = await getUserPlan(user.id);

    if (plan === "free") {
      const recentScan = await prisma.scan.findFirst({
        where: {
          orgId,
          startedAt: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000),
          },
        },
      });
      if (recentScan) {
        return NextResponse.json(
          { error: "Free plan allows 1 scan per 24 hours" },
          { status: 429 }
        );
      }
    }

    const scan = await prisma.scan.create({
      data: {
        orgId,
        status: "queued",
      },
    });

    await inngest.send({
      name: "scan/run",
      data: {
        scanId: scan.id,
        orgId: org.id,
        orgName: org.name,
        userId: user.id,
        plan,
      },
    });

    return NextResponse.json(scan);
  } catch (e) {
    console.error("POST /api/scan/start error:", e instanceof Error ? e.message : "Unknown error");
    return serverError();
  }
}
