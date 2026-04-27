import { requireOsSession } from "@/lib/os/session";
import { withClient } from "@/lib/os/tenancy";
import { getDb } from "@/lib/db";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { saveSettingsAction, saveStripeKeysAction, clearCacheAction } from "./actions";

async function load() {
  return withClient(async ({ clientId }) => {
    const sql = getDb();
    const [client, settings] = await Promise.all([
      sql`SELECT name, primary_host FROM clients WHERE id = ${clientId}` as unknown as Promise<Array<{ name: string; primary_host: string | null }>>,
      sql`SELECT favicon_url, default_og_image_url, primary_phone, stripe_secret_key, stripe_publishable_key FROM site_settings WHERE client_id = ${clientId}` as unknown as Promise<Array<{ favicon_url: string | null; default_og_image_url: string | null; primary_phone: string | null; stripe_secret_key: string | null; stripe_publishable_key: string | null }>>,
    ]);
    return {
      client: client[0],
      settings: settings[0] ?? { favicon_url: null, default_og_image_url: null, primary_phone: null, stripe_secret_key: null, stripe_publishable_key: null },
    };
  });
}

function maskSecret(key: string | null): string {
  if (!key) return "";
  if (key.length <= 12) return "********";
  return `${key.slice(0, 7)}…${key.slice(-4)}`;
}

export default async function SettingsPage({ searchParams }: { searchParams: { saved?: string; cache?: string } }) {
  requireOsSession();
  const data = await load();
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-navy">Site settings</h1>
        <p className="text-sm text-navy/60 mt-1">Site-wide defaults, Stripe keys, and cache controls.</p>
      </div>

      {searchParams.saved ? (
        <div className="rounded-lg bg-green-50 border border-green-200 p-3 text-sm text-green-800">Saved.</div>
      ) : null}
      {searchParams.cache ? (
        <div className="rounded-lg bg-blue-50 border border-blue-200 p-3 text-sm text-blue-800">
          Cache cleared. Public pages will rebuild on next request.
        </div>
      ) : null}

      <Card>
        <CardHeader><CardTitle>{data.client?.name ?? "Site"} ({data.client?.primary_host ?? ""})</CardTitle></CardHeader>
        <CardBody>
          <form action={saveSettingsAction} className="space-y-4">
            <div>
              <Label htmlFor="favicon_url">Favicon URL</Label>
              <Input id="favicon_url" name="favicon_url" defaultValue={data.settings.favicon_url ?? ""} className="mt-1" />
            </div>
            <div>
              <Label htmlFor="default_og_image_url">Default social share image URL</Label>
              <Input id="default_og_image_url" name="default_og_image_url" defaultValue={data.settings.default_og_image_url ?? ""} className="mt-1" />
            </div>
            <div>
              <Label htmlFor="primary_phone">Primary phone</Label>
              <Input id="primary_phone" name="primary_phone" defaultValue={data.settings.primary_phone ?? ""} className="mt-1" />
            </div>
            <div className="flex justify-end">
              <Button type="submit" size="lg">Save settings</Button>
            </div>
          </form>
        </CardBody>
      </Card>

      <Card>
        <CardHeader><CardTitle>Stripe</CardTitle></CardHeader>
        <CardBody>
          <p className="text-xs text-navy/60 mb-3">
            Used by the Products page to sync products and prices to your Stripe account. Find these in
            {" "}
            <a href="https://dashboard.stripe.com/apikeys" target="_blank" rel="noreferrer" className="text-orange hover:underline">
              Stripe → Developers → API keys
            </a>.
          </p>
          <form action={saveStripeKeysAction} className="space-y-4">
            <div>
              <Label htmlFor="stripe_secret_key">Secret key</Label>
              <Input
                id="stripe_secret_key"
                name="stripe_secret_key"
                type="password"
                placeholder={data.settings.stripe_secret_key ? `Stored: ${maskSecret(data.settings.stripe_secret_key)}` : "sk_live_…"}
                className="mt-1"
              />
              <p className="text-xs text-navy/50 mt-1">Leave blank to keep the existing value.</p>
            </div>
            <div>
              <Label htmlFor="stripe_publishable_key">Publishable key</Label>
              <Input
                id="stripe_publishable_key"
                name="stripe_publishable_key"
                defaultValue={data.settings.stripe_publishable_key ?? ""}
                placeholder="pk_live_…"
                className="mt-1"
              />
            </div>
            <div className="flex justify-end">
              <Button type="submit">Save Stripe keys</Button>
            </div>
          </form>
        </CardBody>
      </Card>

      <Card>
        <CardHeader><CardTitle>Cache</CardTitle></CardHeader>
        <CardBody>
          <p className="text-sm text-navy/70">
            Force the public site and the dashboard to rebuild their cached data on next request. Use this if you've
            updated content elsewhere and want it to show up immediately.
          </p>
          <form action={clearCacheAction} className="mt-4">
            <Button type="submit" variant="secondary">Clear cache</Button>
          </form>
        </CardBody>
      </Card>
    </div>
  );
}
