"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { withClient } from "@/lib/os/tenancy";
import { audit } from "@/lib/os/audit";

const trackingSchema = z.object({
  ga4_id: z.string().max(40),
  gtm_id: z.string().max(40),
  google_verification: z.string().max(120),
  bing_verification: z.string().max(120),
});

export async function saveTrackingAction(formData: FormData) {
  const parsed = trackingSchema.parse({
    ga4_id: String(formData.get("ga4_id") || ""),
    gtm_id: String(formData.get("gtm_id") || ""),
    google_verification: String(formData.get("google_verification") || ""),
    bing_verification: String(formData.get("bing_verification") || ""),
  });
  await withClient(async ({ session, clientId }) => {
    const sql = getDb();
    await sql`
      INSERT INTO site_settings (client_id, ga4_id, gtm_id, google_verification, bing_verification)
      VALUES (${clientId}, ${parsed.ga4_id || null}, ${parsed.gtm_id || null}, ${parsed.google_verification || null}, ${parsed.bing_verification || null})
      ON CONFLICT (client_id) DO UPDATE SET
        ga4_id = EXCLUDED.ga4_id,
        gtm_id = EXCLUDED.gtm_id,
        google_verification = EXCLUDED.google_verification,
        bing_verification = EXCLUDED.bing_verification,
        updated_at = NOW()
    `;
    await audit(session, "tracking.update", "site_settings", clientId);
  });
  revalidatePath("/site");
  redirect("/os/tracking?saved=1");
}
