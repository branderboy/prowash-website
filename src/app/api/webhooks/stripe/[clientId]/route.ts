import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { getDb } from "@/lib/db";
import { getStripeForClient } from "@/lib/stripe";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, { params }: { params: { clientId: string } }) {
  const clientId = Number(params.clientId);
  if (!Number.isFinite(clientId)) {
    return NextResponse.json({ error: "invalid clientId" }, { status: 400 });
  }

  const sig = req.headers.get("stripe-signature");
  if (!sig) {
    return NextResponse.json({ error: "missing signature" }, { status: 400 });
  }

  const sql = getDb();
  const rows = (await sql`
    SELECT stripe_webhook_secret FROM site_settings
    WHERE client_id = ${clientId} LIMIT 1
  `) as Array<{ stripe_webhook_secret: string | null }>;
  const secret = rows[0]?.stripe_webhook_secret;
  if (!secret) {
    return NextResponse.json({ error: "webhook not configured" }, { status: 503 });
  }

  const stripe = await getStripeForClient(clientId);
  if (!stripe) {
    return NextResponse.json({ error: "stripe not configured" }, { status: 503 });
  }

  const rawBody = await req.text();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, secret);
  } catch (err) {
    return NextResponse.json(
      { error: "signature verification failed", detail: err instanceof Error ? err.message : String(err) },
      { status: 400 }
    );
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const lineItems = await stripe.checkout.sessions.listLineItems(session.id, { limit: 100 });
    const lineSummary = lineItems.data.map((li) => ({
      description: li.description,
      quantity: li.quantity,
      amount_total: li.amount_total,
      price: li.price?.id ?? null,
    }));

    await sql`
      INSERT INTO orders (
        client_id, stripe_session_id, stripe_payment_intent_id,
        customer_email, customer_name, amount_total, currency, status,
        line_items, metadata
      )
      VALUES (
        ${clientId},
        ${session.id},
        ${typeof session.payment_intent === "string" ? session.payment_intent : null},
        ${session.customer_details?.email ?? null},
        ${session.customer_details?.name ?? null},
        ${session.amount_total ?? null},
        ${session.currency ?? null},
        ${session.payment_status === "paid" ? "paid" : "pending"},
        ${JSON.stringify(lineSummary)}::jsonb,
        ${JSON.stringify(session.metadata ?? {})}::jsonb
      )
      ON CONFLICT (stripe_session_id) DO NOTHING
    `;
  }

  return NextResponse.json({ received: true });
}
