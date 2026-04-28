import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import type Stripe from "stripe";
import { getDb } from "@/lib/db";
import { resolveTenantClientId } from "@/lib/site/resolve-client";
import { getStripeForClient } from "@/lib/stripe";

export const dynamic = "force-dynamic";

async function originFromRequest(req: NextRequest): Promise<string> {
  const h = await headers();
  const cfVisitor = h.get("cf-visitor");
  let cfScheme: string | null = null;
  if (cfVisitor) {
    try {
      const parsed = JSON.parse(cfVisitor) as { scheme?: string };
      if (parsed.scheme) cfScheme = parsed.scheme;
    } catch { /* ignore */ }
  }
  const proto = cfScheme || h.get("x-forwarded-proto") || (req.url.startsWith("https") ? "https" : "http");
  const host = h.get("host");
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
  const [productRows, settingsRows] = await Promise.all([
    sql`
      SELECT id, stripe_price_id, active FROM products
      WHERE id = ${productId} AND client_id = ${clientId}
      LIMIT 1
    ` as unknown as Promise<Array<{ id: number; stripe_price_id: string | null; active: boolean }>>,
    sql`
      SELECT shipping_rate_amount, shipping_rate_label, shipping_countries, tax_enabled,
             pickup_enabled, pickup_label
      FROM site_settings WHERE client_id = ${clientId} LIMIT 1
    ` as unknown as Promise<Array<{ shipping_rate_amount: number | null; shipping_rate_label: string | null; shipping_countries: string | null; tax_enabled: boolean | null; pickup_enabled: boolean | null; pickup_label: string | null }>>,
  ]);
  const product = productRows[0];
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

  const settings = settingsRows[0] ?? {
    shipping_rate_amount: null,
    shipping_rate_label: null,
    shipping_countries: null,
    tax_enabled: false,
    pickup_enabled: false,
    pickup_label: null,
  };
  const allowedCountries = (settings.shipping_countries ?? "")
    .split(",")
    .map((c) => c.trim().toUpperCase())
    .filter((c) => /^[A-Z]{2}$/.test(c));

  const origin = await originFromRequest(req);
  const params: Stripe.Checkout.SessionCreateParams = {
    mode: "payment",
    line_items: [{ price: product.stripe_price_id, quantity }],
    success_url: `${origin}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/checkout/cancel`,
    metadata: {
      tagglefish_client_id: String(clientId),
      tagglefish_product_id: String(product.id),
    },
  };
  if (settings.tax_enabled) {
    params.automatic_tax = { enabled: true };
  }
  const shippingOptions: Stripe.Checkout.SessionCreateParams.ShippingOption[] = [];
  if (settings.shipping_rate_amount != null && settings.shipping_rate_amount >= 0) {
    shippingOptions.push({
      shipping_rate_data: {
        type: "fixed_amount",
        fixed_amount: { amount: settings.shipping_rate_amount, currency: "usd" },
        display_name: settings.shipping_rate_label || "Standard shipping",
      },
    });
  }
  if (settings.pickup_enabled) {
    shippingOptions.push({
      shipping_rate_data: {
        type: "fixed_amount",
        fixed_amount: { amount: 0, currency: "usd" },
        display_name: settings.pickup_label || "In-store pickup at Carrolton",
      },
    });
  }
  if (allowedCountries.length > 0 || settings.pickup_enabled) {
    // Stripe requires shipping_address_collection whenever shipping_options is set,
    // so default to US-only if pickup is the only option.
    params.shipping_address_collection = {
      allowed_countries: (allowedCountries.length > 0
        ? allowedCountries
        : ["US"]) as Stripe.Checkout.SessionCreateParams.ShippingAddressCollection.AllowedCountry[],
    };
    if (shippingOptions.length > 0) {
      params.shipping_options = shippingOptions;
    }
  }

  const session = await stripe.checkout.sessions.create(params);

  if (!session.url) {
    return NextResponse.json({ error: "failed to create checkout session" }, { status: 502 });
  }
  return NextResponse.redirect(session.url, { status: 303 });
}
