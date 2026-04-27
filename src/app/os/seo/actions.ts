"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { withClient } from "@/lib/os/tenancy";
import { audit } from "@/lib/os/audit";

const seoSchema = z.object({
  robots_txt: z.string().max(20000),
  sitemap_extra_urls: z.string().max(20000),
});

export async function saveSeoAction(formData: FormData) {
  const parsed = seoSchema.parse({
    robots_txt: String(formData.get("robots_txt") || ""),
    sitemap_extra_urls: String(formData.get("sitemap_extra_urls") || ""),
  });
  await withClient(async ({ session, clientId }) => {
    const sql = getDb();
    await sql`
      INSERT INTO site_settings (client_id, robots_txt, sitemap_extra_urls)
      VALUES (${clientId}, ${parsed.robots_txt}, ${parsed.sitemap_extra_urls})
      ON CONFLICT (client_id) DO UPDATE SET
        robots_txt = EXCLUDED.robots_txt,
        sitemap_extra_urls = EXCLUDED.sitemap_extra_urls,
        updated_at = NOW()
    `;
    await audit(session, "seo.update", "site_settings", clientId);
  });
  revalidatePath("/robots.txt");
  revalidatePath("/sitemap.xml");
  redirect("/os/seo?saved=1");
}

export async function deleteRedirectAction(id: number) {
  await withClient(async ({ session, clientId }) => {
    const sql = getDb();
    const result = (await sql`
      DELETE FROM redirects WHERE id = ${id} AND client_id = ${clientId} RETURNING id
    `) as Array<{ id: number }>;
    if (result[0]) await audit(session, "redirect.delete", "redirect", id);
  });
  redirect("/os/seo");
}
