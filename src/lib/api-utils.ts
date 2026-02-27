import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { decrypt, isEncrypted } from "@/lib/encryption";
import { z } from "zod";

export async function getAuthenticatedUser() {
  const session = await auth();
  if (!session?.user?.id) {
    return null;
  }
  return { ...session.user, id: session.user.id };
}

export function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

export function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

export function serverError(message = "Internal server error") {
  return NextResponse.json({ error: message }, { status: 500 });
}

export async function getUserPlan(userId: string) {
  const sub = await prisma.subscription.findUnique({
    where: { userId },
  });
  return sub?.plan ?? "free";
}

export async function getAccessToken(userId: string) {
  const account = await prisma.account.findFirst({
    where: { userId, provider: "github" },
  });
  const token = account?.access_token ?? null;
  if (token && isEncrypted(token)) {
    return decrypt(token);
  }
  return token;
}

const uuidSchema = z.string().uuid();

export function validateUUID(value: string): string | null {
  const result = uuidSchema.safeParse(value);
  return result.success ? result.data : null;
}
