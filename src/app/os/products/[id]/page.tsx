import Link from "next/link";
import { notFound } from "next/navigation";
import { requireOsSession } from "@/lib/os/session";
import { withClient } from "@/lib/os/tenancy";
import { getDb } from "@/lib/db";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { updateProductAction, archiveProductAction } from "../actions";

type Product = {
  id: number;
  name: string;
  description: string | null;
  image_url: string | null;
  unit_amount: number;
  currency: string;
  active: boolean;
  stripe_product_id: string | null;
  stripe_price_id: string | null;
};

async function getProduct(id: number) {
  return withClient(async ({ clientId }) => {
    const sql = getDb();
    const rows = (await sql`
      SELECT id, name, description, image_url, unit_amount, currency, active, stripe_product_id, stripe_price_id
      FROM products WHERE id = ${id} AND client_id = ${clientId} LIMIT 1
    `) as Product[];
    return rows[0] ?? null;
  });
}

export default async function ProductEditPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ saved?: string }> }) {
  await requireOsSession();
  const { id: rawId } = await params;
  const sp = await searchParams;
  const id = Number(rawId);
  if (!Number.isFinite(id)) notFound();
  const product = await getProduct(id);
  if (!product) notFound();

  const update = updateProductAction.bind(null, id);
  const archive = archiveProductAction.bind(null, id);

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <Link href="/os/products" className="text-sm text-orange hover:underline">← Products</Link>
        <h1 className="text-2xl font-bold text-navy mt-2">{product.name}</h1>
        {product.stripe_product_id ? (
          <div className="text-xs text-navy/40 font-mono mt-1">{product.stripe_product_id}</div>
        ) : (
          <p className="text-xs text-amber-700 mt-1">Not yet synced to Stripe — saving will sync if Stripe is connected.</p>
        )}
      </div>

      {sp.saved ? (
        <div className="rounded-lg bg-green-50 border border-green-200 p-3 text-sm text-green-800">Saved.</div>
      ) : null}

      <Card>
        <CardHeader><CardTitle>Details</CardTitle></CardHeader>
        <CardBody>
          <form action={update} className="space-y-4">
            <div>
              <Label htmlFor="name">Name</Label>
              <Input id="name" name="name" defaultValue={product.name} required className="mt-1" />
            </div>
            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea id="description" name="description" rows={3} defaultValue={product.description ?? ""} />
            </div>
            <div>
              <Label htmlFor="image_url">Image URL</Label>
              <Input id="image_url" name="image_url" defaultValue={product.image_url ?? ""} className="mt-1" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="unit_amount_dollars">Price (dollars)</Label>
                <Input id="unit_amount_dollars" name="unit_amount_dollars" type="number" step="0.01" min="0" required defaultValue={(product.unit_amount / 100).toFixed(2)} className="mt-1" />
              </div>
              <div>
                <Label htmlFor="currency">Currency</Label>
                <Input id="currency" name="currency" defaultValue={product.currency} maxLength={3} className="mt-1 uppercase" />
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm text-navy">
              <input type="checkbox" name="active" defaultChecked={product.active} />
              Active (available for purchase)
            </label>
            <div className="flex justify-end">
              <Button type="submit" size="lg">Save</Button>
            </div>
          </form>
        </CardBody>
      </Card>

      {product.active ? (
        <form action={archive}>
          <button className="text-red-600 text-sm hover:underline" type="submit">
            Archive product
          </button>
        </form>
      ) : null}
    </div>
  );
}
