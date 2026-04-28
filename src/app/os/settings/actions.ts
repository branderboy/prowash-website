"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { withClient } from "@/lib/os/tenancy";
import { audit } from "@/lib/os/audit";
import { clearStripeCache } from "@/lib/stripe";
import { getCloudflareCreds, purgeCloudflare, verifyCloudflare } from "@/lib/cloudflare";

const schema = z.object({
  favicon_url: z.string().max(500),
  default_og_image_url: z.string().max(500),
  primary_phone: z.string().max(40),
});

export async function saveSettingsAction(formData: FormData) {
  const parsed = schema.parse({
    favicon_url: String(formData.get("favicon_url") || ""),
    default_og_image_url: String(formData.get("default_og_image_url") || ""),
    primary_phone: String(formData.get("primary_phone") || ""),
  });
  await withClient(async ({ session, clientId }) => {
    const sql = getDb();
    await sql`
      INSERT INTO site_settings (client_id, favicon_url, default_og_image_url, primary_phone)
      VALUES (${clientId}, ${parsed.favicon_url || null}, ${parsed.default_og_image_url || null}, ${parsed.primary_phone || null})
      ON CONFLICT (client_id) DO UPDATE SET
        favicon_url = EXCLUDED.favicon_url,
        default_og_image_url = EXCLUDED.default_og_image_url,
        primary_phone = EXCLUDED.primary_phone,
        updated_at = NOW()
    `;
    await audit(session, "settings.update", "site_settings", clientId);
  });
  revalidatePath("/site");
  redirect("/os/settings?saved=1");
}

const stripeSchema = z.object({
  stripe_secret_key: z.string().max(200),
  stripe_publishable_key: z.string().max(200),
  stripe_webhook_secret: z.string().max(200),
});

export async function saveStripeKeysAction(formData: FormData) {
  const parsed = stripeSchema.parse({
    stripe_secret_key: String(formData.get("stripe_secret_key") || ""),
    stripe_publishable_key: String(formData.get("stripe_publishable_key") || ""),
    stripe_webhook_secret: String(formData.get("stripe_webhook_secret") || ""),
  });
  // Both secret fields are blank-by-default; an empty submission means
  // "keep the stored value", not "delete it".
  const newSecret = parsed.stripe_secret_key.trim() === "" ? null : parsed.stripe_secret_key;
  const newWebhookSecret = parsed.stripe_webhook_secret.trim() === "" ? null : parsed.stripe_webhook_secret;
  await withClient(async ({ session, clientId }) => {
    const sql = getDb();
    // Always update publishable key (not a secret); conditionally update each secret.
    await sql`
      INSERT INTO site_settings (client_id, stripe_publishable_key)
      VALUES (${clientId}, ${parsed.stripe_publishable_key || null})
      ON CONFLICT (client_id) DO UPDATE SET
        stripe_publishable_key = EXCLUDED.stripe_publishable_key,
        updated_at = NOW()
    `;
    if (newSecret !== null) {
      await sql`UPDATE site_settings SET stripe_secret_key = ${newSecret}, updated_at = NOW() WHERE client_id = ${clientId}`;
    }
    if (newWebhookSecret !== null) {
      await sql`UPDATE site_settings SET stripe_webhook_secret = ${newWebhookSecret}, updated_at = NOW() WHERE client_id = ${clientId}`;
    }
    clearStripeCache(clientId);
    await audit(session, "stripe.update", "site_settings", clientId, {
      has_secret: newSecret !== null,
      has_webhook_secret: newWebhookSecret !== null,
    });
  });
  redirect("/os/settings?saved=1");
}

const storeSchema = z.object({
  shipping_rate_amount: z.coerce.number().int().min(0).max(1000000).nullable(),
  shipping_rate_label: z.string().max(120),
  shipping_countries: z.string().max(500),
  tax_enabled: z.boolean(),
  pickup_enabled: z.boolean(),
  pickup_label: z.string().max(120),
  pickup_address: z.string().max(400),
});

export async function saveStoreSettingsAction(formData: FormData) {
  const rawAmount = String(formData.get("shipping_rate_amount") || "").trim();
  const parsed = storeSchema.parse({
    shipping_rate_amount: rawAmount === "" ? null : Math.round(Number(rawAmount) * 100),
    shipping_rate_label: String(formData.get("shipping_rate_label") || ""),
    shipping_countries: String(formData.get("shipping_countries") || ""),
    tax_enabled: formData.get("tax_enabled") === "on",
    pickup_enabled: formData.get("pickup_enabled") === "on",
    pickup_label: String(formData.get("pickup_label") || ""),
    pickup_address: String(formData.get("pickup_address") || ""),
  });
  await withClient(async ({ session, clientId }) => {
    const sql = getDb();
    await sql`
      INSERT INTO site_settings (
        client_id, shipping_rate_amount, shipping_rate_label, shipping_countries, tax_enabled,
        pickup_enabled, pickup_label, pickup_address
      )
      VALUES (
        ${clientId}, ${parsed.shipping_rate_amount}, ${parsed.shipping_rate_label || null},
        ${parsed.shipping_countries || null}, ${parsed.tax_enabled},
        ${parsed.pickup_enabled}, ${parsed.pickup_label || null}, ${parsed.pickup_address || null}
      )
      ON CONFLICT (client_id) DO UPDATE SET
        shipping_rate_amount = EXCLUDED.shipping_rate_amount,
        shipping_rate_label = EXCLUDED.shipping_rate_label,
        shipping_countries = EXCLUDED.shipping_countries,
        tax_enabled = EXCLUDED.tax_enabled,
        pickup_enabled = EXCLUDED.pickup_enabled,
        pickup_label = EXCLUDED.pickup_label,
        pickup_address = EXCLUDED.pickup_address,
        updated_at = NOW()
    `;
    await audit(session, "store.update", "site_settings", clientId, {
      tax_enabled: parsed.tax_enabled,
      ships: parsed.shipping_countries || null,
      pickup_enabled: parsed.pickup_enabled,
    });
  });
  redirect("/os/settings?saved=1");
}

const cloudflareSchema = z.object({
  cloudflare_api_token: z.string().max(200),
  cloudflare_zone_id: z.string().max(120),
});

export async function saveCloudflareAction(formData: FormData) {
  const parsed = cloudflareSchema.parse({
    cloudflare_api_token: String(formData.get("cloudflare_api_token") || ""),
    cloudflare_zone_id: String(formData.get("cloudflare_zone_id") || ""),
  });
  // The token field starts blank on every render; an empty submission
  // means "keep the stored token", not "delete it".
  const newToken = parsed.cloudflare_api_token.trim() === "" ? null : parsed.cloudflare_api_token;
  await withClient(async ({ session, clientId }) => {
    const sql = getDb();
    if (newToken === null) {
      await sql`
        INSERT INTO site_settings (client_id, cloudflare_zone_id)
        VALUES (${clientId}, ${parsed.cloudflare_zone_id || null})
        ON CONFLICT (client_id) DO UPDATE SET
          cloudflare_zone_id = EXCLUDED.cloudflare_zone_id,
          updated_at = NOW()
      `;
    } else {
      await sql`
        INSERT INTO site_settings (client_id, cloudflare_api_token, cloudflare_zone_id)
        VALUES (${clientId}, ${newToken}, ${parsed.cloudflare_zone_id || null})
        ON CONFLICT (client_id) DO UPDATE SET
          cloudflare_api_token = EXCLUDED.cloudflare_api_token,
          cloudflare_zone_id = EXCLUDED.cloudflare_zone_id,
          updated_at = NOW()
      `;
    }
    await audit(session, "cloudflare.update", "site_settings", clientId, {
      has_token: newToken !== null,
      zone_id: parsed.cloudflare_zone_id || null,
    });
  });
  redirect("/os/settings?saved=1");
}

export async function testCloudflareAction() {
  const result = await withClient(async ({ clientId }) => {
    const creds = await getCloudflareCreds(clientId);
    if (!creds) return { ok: false, msg: "Cloudflare credentials not set" };
    const v = await verifyCloudflare(creds);
    return v.ok ? { ok: true, msg: `Connected to zone: ${v.name}` } : { ok: false, msg: v.error || "Verification failed" };
  });
  const param = result.ok ? "cf_ok" : "cf_err";
  redirect(`/os/settings?${param}=${encodeURIComponent(result.msg)}`);
}

export async function clearCacheAction() {
  let cfMsg = "";
  await withClient(async ({ session, clientId }) => {
    revalidatePath("/", "layout");
    revalidatePath("/site", "layout");

    const creds = await getCloudflareCreds(clientId);
    if (creds) {
      const purge = await purgeCloudflare(creds, { everything: true });
      cfMsg = purge.ok ? "purged" : `error:${purge.errors.join(",")}`;
      await audit(session, "cache.clear", "cache", null, {
        cloudflare: purge.ok ? "ok" : "error",
        cf_errors: purge.errors,
      });
    } else {
      cfMsg = "no-cf";
      await audit(session, "cache.clear", "cache", null, { cloudflare: "not_configured" });
    }
  });
  redirect(`/os/settings?cache=${encodeURIComponent(cfMsg)}`);
}
