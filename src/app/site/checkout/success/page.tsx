import { getDb } from "@/lib/db";
import { resolveTenantClientId } from "@/lib/site/resolve-client";

export const dynamic = "force-dynamic";

export default async function CheckoutSuccessPage({ searchParams }: { searchParams: Promise<{ session_id?: string }> }) {
  const sp = await searchParams;
  const clientId = await resolveTenantClientId();
  let pickupAddress: string | null = null;
  let pickupLabel: string | null = null;
  if (clientId) {
    const sql = getDb();
    const rows = (await sql`
      SELECT pickup_enabled, pickup_label, pickup_address
      FROM site_settings WHERE client_id = ${clientId} LIMIT 1
    `) as Array<{ pickup_enabled: boolean | null; pickup_label: string | null; pickup_address: string | null }>;
    if (rows[0]?.pickup_enabled) {
      pickupAddress = rows[0].pickup_address ?? null;
      pickupLabel = rows[0].pickup_label ?? null;
    }
  }
  return (
    <section className="section-padding">
      <div className="container" style={{ maxWidth: 640, textAlign: "center", padding: "4rem 1rem" }}>
        <h1>Thank you!</h1>
        <p style={{ marginTop: "1rem" }}>
          Your order has been received. You'll get an email confirmation from Stripe shortly.
        </p>
        {pickupAddress ? (
          <div style={{ marginTop: "2rem", padding: "1rem", background: "#fdf6ec", borderRadius: 8, textAlign: "left" }}>
            <strong>If you chose {pickupLabel || "in-store pickup"}:</strong>
            <p style={{ marginTop: "0.5rem", marginBottom: 0 }}>
              Pick up at <strong>{pickupAddress}</strong>. We'll call you when your order is ready.
            </p>
          </div>
        ) : null}
        {sp.session_id ? (
          <p style={{ marginTop: "0.5rem", fontSize: "0.85rem", color: "#666" }}>
            Reference: <code>{sp.session_id}</code>
          </p>
        ) : null}
        <a href="/shop" className="btn-add-cart" style={{ display: "inline-block", marginTop: "2rem" }}>
          Back to shop
        </a>
      </div>
    </section>
  );
}
