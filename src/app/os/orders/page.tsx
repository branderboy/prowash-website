import { requireOsSession } from "@/lib/os/session";
import { withClient } from "@/lib/os/tenancy";
import { getDb } from "@/lib/db";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

type Row = {
  id: number;
  stripe_session_id: string;
  customer_email: string | null;
  customer_name: string | null;
  amount_total: number | null;
  currency: string | null;
  status: string;
  created_at: string;
};

function formatMoney(cents: number | null, currency: string | null): string {
  if (cents == null || !currency) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: currency.toUpperCase() }).format(cents / 100);
}

async function listOrders() {
  return withClient(async ({ clientId }) => {
    const sql = getDb();
    return (await sql`
      SELECT id, stripe_session_id, customer_email, customer_name, amount_total, currency, status, created_at
      FROM orders
      WHERE client_id = ${clientId}
      ORDER BY created_at DESC
      LIMIT 200
    `) as Row[];
  });
}

export default async function OrdersPage() {
  requireOsSession();
  const orders = await listOrders();
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-navy">Orders</h1>
        <p className="text-sm text-navy/60 mt-1">
          Stripe Checkout completions land here via the per-tenant webhook. Configure the webhook URL in
          Settings → Stripe.
        </p>
      </div>
      <Card>
        <CardHeader><CardTitle>Recent orders</CardTitle></CardHeader>
        <CardBody className="p-0">
          {orders.length === 0 ? (
            <div className="p-8 text-center text-sm text-navy/60">
              No orders yet.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase text-navy/60">
                <tr>
                  <th className="px-5 py-3">Date</th>
                  <th className="px-5 py-3">Customer</th>
                  <th className="px-5 py-3">Total</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Session</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-navy/5">
                {orders.map((o) => (
                  <tr key={o.id}>
                    <td className="px-5 py-3 text-navy/70">{formatDate(o.created_at)}</td>
                    <td className="px-5 py-3">
                      <div>{o.customer_name ?? "—"}</div>
                      <div className="text-xs text-navy/50">{o.customer_email ?? ""}</div>
                    </td>
                    <td className="px-5 py-3 font-mono">{formatMoney(o.amount_total, o.currency)}</td>
                    <td className="px-5 py-3 capitalize">{o.status}</td>
                    <td className="px-5 py-3 font-mono text-[10px] text-navy/40">{o.stripe_session_id}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
