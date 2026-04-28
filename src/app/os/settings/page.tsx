import { requireOsSession } from "@/lib/os/session";
import { withClient } from "@/lib/os/tenancy";
import { getDb } from "@/lib/db";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { saveSettingsAction, saveStripeKeysAction, saveStoreSettingsAction, saveCloudflareAction, testCloudflareAction, clearCacheAction } from "./actions";

type Settings = {
  favicon_url: string | null;
  default_og_image_url: string | null;
  primary_phone: string | null;
  stripe_secret_key: string | null;
  stripe_publishable_key: string | null;
  stripe_webhook_secret: string | null;
  cloudflare_api_token: string | null;
  cloudflare_zone_id: string | null;
  shipping_rate_amount: number | null;
  shipping_rate_label: string | null;
  shipping_countries: string | null;
  tax_enabled: boolean | null;
  pickup_enabled: boolean | null;
  pickup_label: string | null;
  pickup_address: string | null;
};

async function load() {
  return withClient(async ({ clientId }) => {
    const sql = getDb();
    const [client, settings] = await Promise.all([
      sql`SELECT name, primary_host FROM clients WHERE id = ${clientId}` as unknown as Promise<Array<{ name: string; primary_host: string | null }>>,
      sql`SELECT favicon_url, default_og_image_url, primary_phone, stripe_secret_key, stripe_publishable_key, stripe_webhook_secret, cloudflare_api_token, cloudflare_zone_id, shipping_rate_amount, shipping_rate_label, shipping_countries, tax_enabled, pickup_enabled, pickup_label, pickup_address FROM site_settings WHERE client_id = ${clientId}` as unknown as Promise<Array<Settings>>,
    ]);
    const empty: Settings = {
      favicon_url: null, default_og_image_url: null, primary_phone: null,
      stripe_secret_key: null, stripe_publishable_key: null, stripe_webhook_secret: null,
      cloudflare_api_token: null, cloudflare_zone_id: null,
      shipping_rate_amount: null, shipping_rate_label: null, shipping_countries: null, tax_enabled: false,
      pickup_enabled: false, pickup_label: null, pickup_address: null,
    };
    return {
      clientId,
      client: client[0],
      settings: settings[0] ?? empty,
    };
  });
}

function maskSecret(key: string | null): string {
  if (!key) return "";
  if (key.length <= 12) return "********";
  return `${key.slice(0, 7)}…${key.slice(-4)}`;
}

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ saved?: string; cache?: string; cf_ok?: string; cf_err?: string }> }) {
  await requireOsSession();
  const data = await load();
  const sp = await searchParams;

  const cacheMsg = sp.cache;
  let cacheBanner: { tone: "blue" | "green" | "red"; text: string } | null = null;
  if (cacheMsg === "purged") {
    cacheBanner = { tone: "green", text: "Cache cleared on Next.js and purged on Cloudflare." };
  } else if (cacheMsg === "no-cf") {
    cacheBanner = { tone: "blue", text: "Next.js cache cleared. Cloudflare not configured — connect it below for a full purge." };
  } else if (cacheMsg && cacheMsg.startsWith("error:")) {
    cacheBanner = { tone: "red", text: `Next.js cache cleared, but Cloudflare purge failed: ${cacheMsg.slice("error:".length)}` };
  } else if (cacheMsg) {
    cacheBanner = { tone: "blue", text: "Cache cleared." };
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-navy">Site settings</h1>
        <p className="text-sm text-navy/60 mt-1">Site-wide defaults, Stripe + Cloudflare connections, and cache controls.</p>
      </div>

      {sp.saved ? (
        <div className="rounded-lg bg-green-50 border border-green-200 p-3 text-sm text-green-800">Saved.</div>
      ) : null}
      {cacheBanner ? (
        <div className={`rounded-lg border p-3 text-sm ${
          cacheBanner.tone === "green" ? "bg-green-50 border-green-200 text-green-800" :
          cacheBanner.tone === "red" ? "bg-red-50 border-red-200 text-red-800" :
          "bg-blue-50 border-blue-200 text-blue-800"
        }`}>{cacheBanner.text}</div>
      ) : null}
      {sp.cf_ok ? (
        <div className="rounded-lg bg-green-50 border border-green-200 p-3 text-sm text-green-800">
          Cloudflare check: {sp.cf_ok}
        </div>
      ) : null}
      {sp.cf_err ? (
        <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-800">
          Cloudflare check failed: {sp.cf_err}
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
            <div>
              <Label htmlFor="stripe_webhook_secret">Webhook signing secret</Label>
              <Input
                id="stripe_webhook_secret"
                name="stripe_webhook_secret"
                type="password"
                placeholder={data.settings.stripe_webhook_secret ? `Stored: ${maskSecret(data.settings.stripe_webhook_secret)}` : "whsec_…"}
                className="mt-1"
              />
              <p className="text-xs text-navy/50 mt-1">
                In Stripe → Developers → Webhooks, add an endpoint pointing to{" "}
                <code className="font-mono">
                  https://{data.client?.primary_host ?? "your-domain"}/api/webhooks/stripe/{data.clientId}
                </code>
                {" "}listening for <code>checkout.session.completed</code>, then paste the signing secret above. Leave blank to keep the existing value.
              </p>
            </div>
            <div className="flex justify-end">
              <Button type="submit">Save Stripe keys</Button>
            </div>
          </form>
        </CardBody>
      </Card>

      <Card>
        <CardHeader><CardTitle>Store: tax & shipping</CardTitle></CardHeader>
        <CardBody>
          <p className="text-xs text-navy/60 mb-3">
            Applied to every Stripe Checkout session created from <code>/shop</code>. Leave shipping
            countries blank for digital-only goods (no shipping address collected).
          </p>
          <form action={saveStoreSettingsAction} className="space-y-4">
            <label className="flex items-center gap-2 text-sm text-navy">
              <input type="checkbox" name="tax_enabled" defaultChecked={Boolean(data.settings.tax_enabled)} />
              Enable Stripe Tax (requires Stripe Tax to be activated in your Stripe dashboard)
            </label>
            <div>
              <Label htmlFor="shipping_countries">Ship to countries</Label>
              <Input
                id="shipping_countries"
                name="shipping_countries"
                defaultValue={data.settings.shipping_countries ?? ""}
                placeholder="US, CA"
                className="mt-1"
              />
              <p className="text-xs text-navy/50 mt-1">
                Comma-separated ISO-3166 alpha-2 codes. Leave blank to skip shipping (digital orders).
              </p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="shipping_rate_amount">Flat shipping rate (dollars)</Label>
                <Input
                  id="shipping_rate_amount"
                  name="shipping_rate_amount"
                  type="number"
                  step="0.01"
                  min="0"
                  defaultValue={data.settings.shipping_rate_amount != null ? (data.settings.shipping_rate_amount / 100).toFixed(2) : ""}
                  placeholder="9.99"
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="shipping_rate_label">Shipping label</Label>
                <Input
                  id="shipping_rate_label"
                  name="shipping_rate_label"
                  defaultValue={data.settings.shipping_rate_label ?? ""}
                  placeholder="Standard shipping"
                  className="mt-1"
                />
              </div>
            </div>
            <div className="border-t border-navy/10 pt-4 mt-2">
              <label className="flex items-center gap-2 text-sm text-navy">
                <input
                  type="checkbox"
                  name="pickup_enabled"
                  defaultChecked={Boolean(data.settings.pickup_enabled)}
                />
                Offer in-store pickup as a free shipping option
              </label>
            </div>
            <div>
              <Label htmlFor="pickup_label">Pickup option label</Label>
              <Input
                id="pickup_label"
                name="pickup_label"
                defaultValue={data.settings.pickup_label ?? ""}
                placeholder="In-store pickup at Carrolton"
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="pickup_address">Pickup location address (shown on order confirmation)</Label>
              <Input
                id="pickup_address"
                name="pickup_address"
                defaultValue={data.settings.pickup_address ?? ""}
                placeholder="123 Main St, Carrolton, MD 20784"
                className="mt-1"
              />
            </div>
            <div className="flex justify-end">
              <Button type="submit">Save store settings</Button>
            </div>
          </form>
        </CardBody>
      </Card>

      <Card>
        <CardHeader><CardTitle>Cloudflare</CardTitle></CardHeader>
        <CardBody>
          <p className="text-xs text-navy/60 mb-3">
            Used to purge the CDN cache when you publish edits. Create a token at{" "}
            <a
              href="https://dash.cloudflare.com/profile/api-tokens"
              target="_blank"
              rel="noreferrer"
              className="text-orange hover:underline"
            >
              Cloudflare → My Profile → API Tokens
            </a>{" "}
            with the <strong>Zone:Cache Purge</strong> permission scoped to your zone. Find the Zone ID on the
            zone overview page in the Cloudflare dashboard.
          </p>
          <form action={saveCloudflareAction} className="space-y-4">
            <div>
              <Label htmlFor="cloudflare_api_token">API token</Label>
              <Input
                id="cloudflare_api_token"
                name="cloudflare_api_token"
                type="password"
                placeholder={data.settings.cloudflare_api_token ? `Stored: ${maskSecret(data.settings.cloudflare_api_token)}` : "cf_…"}
                className="mt-1"
              />
              <p className="text-xs text-navy/50 mt-1">Leave blank to keep the existing value.</p>
            </div>
            <div>
              <Label htmlFor="cloudflare_zone_id">Zone ID</Label>
              <Input
                id="cloudflare_zone_id"
                name="cloudflare_zone_id"
                defaultValue={data.settings.cloudflare_zone_id ?? ""}
                placeholder="e.g. 0123456789abcdef0123456789abcdef"
                className="mt-1 font-mono"
              />
            </div>
            <div className="flex justify-end gap-3">
              <Button type="submit">Save Cloudflare</Button>
            </div>
          </form>
          <form action={testCloudflareAction} className="mt-4">
            <Button type="submit" variant="ghost" size="sm">Test connection</Button>
          </form>
        </CardBody>
      </Card>

      <Card>
        <CardHeader><CardTitle>Cache</CardTitle></CardHeader>
        <CardBody>
          <p className="text-sm text-navy/70">
            Rebuilds the Next.js data cache and, if Cloudflare is connected, purges the entire Cloudflare cache
            for your zone. Use after content changes to make them visible on your live domain immediately.
          </p>
          <form action={clearCacheAction} className="mt-4">
            <Button type="submit" variant="secondary">Clear cache</Button>
          </form>
        </CardBody>
      </Card>
    </div>
  );
}
