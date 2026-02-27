import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser, unauthorized, serverError } from "@/lib/api-utils";
import { getStripe } from "@/lib/stripe";
import { prisma } from "@/lib/prisma";

function getBaseUrl(): string {
  const configured = process.env.NEXTAUTH_URL || process.env.VERCEL_URL;
  if (configured) {
    return configured.startsWith("http") ? configured : `https://${configured}`;
  }
  return "http://localhost:3000";
}

export async function POST(_req: NextRequest) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) return unauthorized();

    let sub = await prisma.subscription.findUnique({
      where: { userId: user.id },
    });

    let customerId = sub?.stripeCustomerId;

    if (!customerId) {
      const customer = await getStripe().customers.create({
        email: user.email ?? undefined,
        metadata: { userId: user.id },
      });
      customerId = customer.id;

      sub = await prisma.subscription.upsert({
        where: { userId: user.id },
        update: { stripeCustomerId: customerId },
        create: {
          userId: user.id,
          stripeCustomerId: customerId,
          plan: "free",
          status: "active",
        },
      });
    }

    const priceId = process.env.NEXT_PUBLIC_STRIPE_PRICE_ID;
    if (!priceId) {
      return NextResponse.json(
        { error: "Stripe price not configured" },
        { status: 500 }
      );
    }

    const baseUrl = getBaseUrl();

    const session = await getStripe().checkout.sessions.create({
      customer: customerId,
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${baseUrl}/?upgrade=success`,
      cancel_url: `${baseUrl}/?upgrade=canceled`,
    });

    return NextResponse.json({ url: session.url });
  } catch (e) {
    console.error("POST /api/stripe/create-checkout error:", e instanceof Error ? e.message : "Unknown");
    return serverError();
  }
}
