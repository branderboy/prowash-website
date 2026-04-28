import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { getDb } from "@/lib/db";
import { resolveTenantClientId } from "@/lib/site/resolve-client";
import { getStripeForClient } from "@/lib/stripe";

export const dynamic = "force-dynamic";

function originFromRequest(req: NextRequest): string {
  const cfVisitor = headers().get("cf-visitor");
  let cfScheme: string | null = null;
  if (cfVisitor) {
    try {
      const parsed = JSON.parse(cfVisitor) as { scheme?: string };
      if (parsed.scheme) cfScheme = parsed.scheme;
    } catch { /* ignore */ }
  }
  const proto = cfScheme || headers().get("x-forwarded-proto") || (req.url.startsWith("https") ? "https" : "http");
  const host = headers().get("host");
  return `${proto}://${host}`;
}

export async function POST(req: NextRequest) {
  const clientId = await resolveTenantClientId();
  if (!clientId) {
    return NextResponse.json({ error: "tenant not found" }, { status: 404 });
  }

  const form = await req.formData();
  const productId = Number(form.get("product_id"));
  const quantity = Math.max(1, Math.min(99, Number(form.get("quantity") || 1)));
  if (!Number.isFinite(productId)) {
    return NextResponse.json({ error: "product_id required" }, { status: 400 });
  }

  const sql = getDb();
  const rows = (await sql`
    SELECT id, stripe_price_id, active FROM products
    WHERE id = ${productId} AND client_id = ${clientId}
    LIMIT 1
  `) as Array<{ id: number; stripe_price_id: string | null; active: boolean }>;
  const product = rows[0];
  if (!product || !product.active) {
    return NextResponse.json({ error: "product unavailable" }, { status: 404 });
  }
  if (!product.stripe_price_id) {
    return NextResponse.json({ error: "product not synced to Stripe" }, { status: 409 });
  }

  const stripe = await getStripeForClient(clientId);
  if (!stripe) {
    return NextResponse.json({ error: "checkout not configured" }, { status: 503 });
  }

  const origin = originFromRequest(req);
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: [{ price: product.stripe_price_id, quantity }],
    success_url: `${origin}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/checkout/cancel`,
    metadata: {
      tagglefish_client_id: String(clientId),
      tagglefish_product_id: String(product.id),
    },
  });

  if (!session.url) {
    return NextResponse.json({ error: "failed to create checkout session" }, { status: 502 });
  }
  return NextResponse.redirect(session.url, { status: 303 });
}
