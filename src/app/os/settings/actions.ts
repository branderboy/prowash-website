"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { withClient } from "@/lib/os/tenancy";
import { audit } from "@/lib/os/audit";
import { clearStripeCache } from "@/lib/stripe";
import { getCloudflareCreds, purgeCloudflare, verifyCloudflare } from "@/lib/cloudflare";

// Allow empty (clears the field) or a valid http(s) / root-relative URL.
const optionalUrl = z
  .string()
  .max(500)
  .refine(
    (v) => v === "" || /^https?:\/\//.test(v) || v.startsWith("/"),
    "Must be empty, an http(s) URL, or a root-relative path"
  );

const schema = z.object({
  favicon_url: optionalUrl,
  default_og_image_url: optionalUrl,
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
});

export async function saveStripeKeysAction(formData: FormData) {
  const parsed = stripeSchema.parse({
    stripe_secret_key: String(formData.get("stripe_secret_key") || ""),
    stripe_publishable_key: String(formData.get("stripe_publishable_key") || ""),
  });
  // Empty submission means "keep existing" (matches the UI hint). The COALESCE
  // on the existing column preserves the stored value; a non-empty submission
  // overwrites it.
  const newSecret = parsed.stripe_secret_key || null;
  const newPublishable = parsed.stripe_publishable_key || null;
  await withClient(async ({ session, clientId }) => {
    const sql = getDb();
    await sql`
      INSERT INTO site_settings (client_id, stripe_secret_key, stripe_publishable_key)
      VALUES (${clientId}, ${newSecret}, ${newPublishable})
      ON CONFLICT (client_id) DO UPDATE SET
        stripe_secret_key = COALESCE(${newSecret}, site_settings.stripe_secret_key),
        stripe_publishable_key = COALESCE(${newPublishable}, site_settings.stripe_publishable_key),
        updated_at = NOW()
    `;
    clearStripeCache(clientId);
    await audit(session, "stripe.update", "site_settings", clientId, {
      has_secret: Boolean(newSecret),
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
  // Blank token = keep existing (matches UI hint). Zone ID overwrites if
  // submitted (it's not secret and the input isn't masked).
  const newToken = parsed.cloudflare_api_token || null;
  const newZone = parsed.cloudflare_zone_id || null;
  await withClient(async ({ session, clientId }) => {
    const sql = getDb();
    await sql`
      INSERT INTO site_settings (client_id, cloudflare_api_token, cloudflare_zone_id)
      VALUES (${clientId}, ${newToken}, ${newZone})
      ON CONFLICT (client_id) DO UPDATE SET
        cloudflare_api_token = COALESCE(${newToken}, site_settings.cloudflare_api_token),
        cloudflare_zone_id = ${newZone},
        updated_at = NOW()
    `;
    await audit(session, "cloudflare.update", "site_settings", clientId, {
      has_token: Boolean(newToken),
      zone_id: newZone,
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
    revalidateTag("os");

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
