import Link from "next/link";
import { requireOsSession } from "@/lib/os/session";
import { withClient } from "@/lib/os/tenancy";
import { getDb } from "@/lib/db";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type Row = {
  id: number;
  name: string;
  description: string | null;
  unit_amount: number;
  currency: string;
  active: boolean;
  stripe_product_id: string | null;
};

async function load() {
  return withClient(async ({ clientId }) => {
    const sql = getDb();
    const [products, settings] = await Promise.all([
      sql`SELECT id, name, description, unit_amount, currency, active, stripe_product_id
          FROM products WHERE client_id = ${clientId}
          ORDER BY active DESC, name ASC` as unknown as Promise<Row[]>,
      sql`SELECT stripe_secret_key FROM site_settings WHERE client_id = ${clientId} LIMIT 1` as unknown as Promise<Array<{ stripe_secret_key: string | null }>>,
    ]);
    return { products, hasStripe: Boolean(settings[0]?.stripe_secret_key) };
  });
}

function formatMoney(cents: number, currency: string): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: currency.toUpperCase() }).format(cents / 100);
}

export default async function ProductsPage() {
  await requireOsSession();
  const data = await load();
  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold text-navy">Products</h1>
          <p className="text-sm text-navy/60 mt-1">Stripe-backed products. Edits here sync to your Stripe account.</p>
        </div>
        <Link href="/os/products/new">
          <Button>New product</Button>
        </Link>
      </div>

      {!data.hasStripe ? (
        <Card>
          <CardBody>
            <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded p-3">
              Stripe isn't connected yet. Add your Stripe secret key in{" "}
              <Link href="/os/settings" className="underline">Settings</Link> to start syncing products.
            </p>
          </CardBody>
        </Card>
      ) : null}

      <Card>
        <CardHeader><CardTitle>All products</CardTitle></CardHeader>
        <CardBody className="p-0">
          {data.products.length === 0 ? (
            <div className="p-8 text-center text-sm text-navy/60">No products yet.</div>
          ) : (
            <ul className="divide-y divide-navy/5">
              {data.products.map((p) => (
                <li key={p.id} className="px-5 py-3 flex items-center justify-between">
                  <div>
                    <Link href={`/os/products/${p.id}`} className="font-medium text-navy hover:text-orange">
                      {p.name}
                    </Link>
                    {p.description ? <div className="text-xs text-navy/60 mt-0.5">{p.description}</div> : null}
                    {p.stripe_product_id ? (
                      <div className="text-[10px] text-navy/40 font-mono mt-0.5">{p.stripe_product_id}</div>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-3 text-sm text-navy/70">
                    <span className="font-mono">{formatMoney(p.unit_amount, p.currency)}</span>
                    <span
                      className={
                        p.active
                          ? "px-2 py-0.5 rounded bg-green-50 text-green-700 text-xs"
                          : "px-2 py-0.5 rounded bg-navy/5 text-navy/50 text-xs"
                      }
                    >
                      {p.active ? "Active" : "Archived"}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
