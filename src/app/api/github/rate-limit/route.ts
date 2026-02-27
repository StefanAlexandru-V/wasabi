import { NextResponse } from "next/server";
import { getAuthenticatedUser, getAccessToken, unauthorized, serverError } from "@/lib/api-utils";
import { fetchRateLimit } from "@/lib/github";

export async function GET() {
  try {
    const user = await getAuthenticatedUser();
    if (!user) return unauthorized();

    const token = await getAccessToken(user.id);
    if (!token) {
      return NextResponse.json({ error: "No GitHub token found" }, { status: 400 });
    }

    const rateLimit = await fetchRateLimit(token);

    return NextResponse.json({
      remaining: rateLimit.remaining,
      limit: rateLimit.limit,
      resetsAt: new Date(rateLimit.reset * 1000).toISOString(),
    });
  } catch (e) {
    console.error("GET /api/github/rate-limit error:", e instanceof Error ? e.message : "Unknown error");
    return serverError();
  }
}
