"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { withClient } from "@/lib/os/tenancy";
import { audit } from "@/lib/os/audit";

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
