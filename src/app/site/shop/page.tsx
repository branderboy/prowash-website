import Link from "next/link";
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
};

function formatMoney(cents: number, currency: string): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: currency.toUpperCase() }).format(cents / 100);
}

export default async function ShopPage() {
  const clientId = await resolveTenantClientId();
  if (!clientId) {
    return <div className="container" style={{ padding: "4rem 0" }}>No tenant configured.</div>;
  }
  const sql = getDb();
  const products = (await sql`
    SELECT id, name, description, image_url, unit_amount, currency
    FROM products
    WHERE client_id = ${clientId} AND active = TRUE
    ORDER BY name ASC
  `) as Row[];

  return (
    <section className="section-padding">
      <div className="container">
        <div className="section-header reveal">
          <span className="section-subtitle">Our Products</span>
          <h1 className="section-title">SHOP CAR CARE PRODUCTS</h1>
          <div className="title-divider"></div>
        </div>

        {products.length === 0 ? (
          <p style={{ textAlign: "center", padding: "3rem 0" }}>
            No products available right now. Check back soon.
          </p>
        ) : (
          <div className="product-grid">
            {products.map((p) => (
              <div className="product-card" key={p.id}>
                <div className="product-img">
                  {p.image_url ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={p.image_url} alt={p.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  ) : (
                    <div className="product-img-placeholder">
                      <svg viewBox="0 0 24 24"><path d="M20 8.69V4h-4.69L12 .69 8.69 4H4v4.69L.69 12 4 15.31V20h4.69L12 23.31 15.31 20H20v-4.69L23.31 12 20 8.69zM12 18c-3.31 0-6-2.69-6-6s2.69-6 6-6 6 2.69 6 6-2.69 6-6 6z"/></svg>
                    </div>
                  )}
                </div>
                <div className="product-body">
                  <h3>{p.name}</h3>
                  {p.description ? <p>{p.description}</p> : null}
                  <div className="product-price-row">
                    <div className="product-price">{formatMoney(p.unit_amount, p.currency)}</div>
                  </div>
                  <Link href={`/shop/${p.id}`} className="btn-add-cart">View product</Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
