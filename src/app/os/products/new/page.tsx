import Link from "next/link";
import { requireOsSession } from "@/lib/os/session";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { createProductAction } from "../actions";

export default function NewProductPage() {
  requireOsSession();
  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <Link href="/os/products" className="text-sm text-orange hover:underline">← Products</Link>
        <h1 className="text-2xl font-bold text-navy mt-2">New product</h1>
      </div>
      <Card>
        <CardHeader><CardTitle>Details</CardTitle></CardHeader>
        <CardBody>
          <form action={createProductAction} className="space-y-4">
            <div>
              <Label htmlFor="name">Name</Label>
              <Input id="name" name="name" required maxLength={200} className="mt-1" />
            </div>
            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea id="description" name="description" rows={3} />
            </div>
            <div>
              <Label htmlFor="image_url">Image URL</Label>
              <Input id="image_url" name="image_url" placeholder="https://..." className="mt-1" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="unit_amount_dollars">Price (dollars)</Label>
                <Input id="unit_amount_dollars" name="unit_amount_dollars" type="number" step="0.01" min="0" required className="mt-1" />
              </div>
              <div>
                <Label htmlFor="currency">Currency</Label>
                <Input id="currency" name="currency" defaultValue="usd" maxLength={3} className="mt-1 uppercase" />
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm text-navy">
              <input type="checkbox" name="active" defaultChecked />
              Active (available for purchase)
            </label>
            <div className="flex justify-end">
              <Button type="submit" size="lg">Create product</Button>
            </div>
          </form>
        </CardBody>
      </Card>
    </div>
  );
}
