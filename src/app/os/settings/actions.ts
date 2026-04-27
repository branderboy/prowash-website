"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { withClient } from "@/lib/os/tenancy";
import { audit } from "@/lib/os/audit";
import { clearStripeCache } from "@/lib/stripe";

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
});

export async function saveStripeKeysAction(formData: FormData) {
  const parsed = stripeSchema.parse({
    stripe_secret_key: String(formData.get("stripe_secret_key") || ""),
    stripe_publishable_key: String(formData.get("stripe_publishable_key") || ""),
  });
  await withClient(async ({ session, clientId }) => {
    const sql = getDb();
    await sql`
      INSERT INTO site_settings (client_id, stripe_secret_key, stripe_publishable_key)
      VALUES (${clientId}, ${parsed.stripe_secret_key || null}, ${parsed.stripe_publishable_key || null})
      ON CONFLICT (client_id) DO UPDATE SET
        stripe_secret_key = EXCLUDED.stripe_secret_key,
        stripe_publishable_key = EXCLUDED.stripe_publishable_key,
        updated_at = NOW()
    `;
    clearStripeCache(clientId);
    await audit(session, "stripe.update", "site_settings", clientId, {
      has_secret: Boolean(parsed.stripe_secret_key),
    });
  });
  redirect("/os/settings?saved=1");
}

export async function clearCacheAction() {
  await withClient(async ({ session }) => {
    revalidatePath("/", "layout");
    revalidatePath("/site", "layout");
    revalidateTag("os");
    await audit(session, "cache.clear", "cache");
  });
  redirect("/os/settings?cache=1");
}
