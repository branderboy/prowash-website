import { notFound } from "next/navigation";
import { getDb } from "@/lib/db";
import { resolveTenantClientId } from "@/lib/site/resolve-client";

export const dynamic = "force-dynamic";

type Row = {
  id: number;
  name: string;
  description: string | null;
  image_url: string | null;
  unit_amount: number;
  currency: string;
  stripe_price_id: string | null;
};

function formatMoney(cents: number, currency: string): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: currency.toUpperCase() }).format(cents / 100);
}

export default async function ProductDetailPage({ params }: { params: { id: string } }) {
  const id = Number(params.id);
  if (!Number.isFinite(id)) notFound();
  const clientId = await resolveTenantClientId();
  if (!clientId) notFound();
  const sql = getDb();
  const rows = (await sql`
    SELECT id, name, description, image_url, unit_amount, currency, stripe_price_id
    FROM products
    WHERE id = ${id} AND client_id = ${clientId} AND active = TRUE
    LIMIT 1
  `) as Row[];
  const product = rows[0];
  if (!product) notFound();

  return (
    <section className="section-padding">
      <div className="container" style={{ maxWidth: 900 }}>
        <a href="/shop" style={{ display: "inline-block", marginBottom: "1.5rem", color: "var(--orange, #ff6a13)" }}>
          ← All products
        </a>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "3rem", alignItems: "start" }}>
          <div>
            {product.image_url ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={product.image_url} alt={product.name} style={{ width: "100%", borderRadius: 12 }} />
            ) : (
              <div className="product-img-placeholder" style={{ aspectRatio: "1/1", borderRadius: 12 }} />
            )}
          </div>
          <div>
            <h1>{product.name}</h1>
            <div className="product-price" style={{ fontSize: "2rem", margin: "1rem 0" }}>
              {formatMoney(product.unit_amount, product.currency)}
            </div>
            {product.description ? <p>{product.description}</p> : null}
            {product.stripe_price_id ? (
              <form action="/api/checkout" method="post" style={{ marginTop: "2rem" }}>
                <input type="hidden" name="product_id" value={product.id} />
                <label style={{ display: "block", marginBottom: 8 }}>
                  Quantity:{" "}
                  <input
                    type="number"
                    name="quantity"
                    defaultValue={1}
                    min={1}
                    max={99}
                    style={{ width: 80, padding: "0.4rem", marginLeft: 8 }}
                  />
                </label>
                <button type="submit" className="btn-add-cart" style={{ marginTop: 12 }}>
                  Buy now
                </button>
              </form>
            ) : (
              <p style={{ marginTop: "2rem", color: "#a96a00" }}>
                Online checkout not available for this product yet. Call (301) 307-1414 to order.
              </p>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
