"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getDb } from "@/lib/db";
import { withClient } from "@/lib/os/tenancy";
import { audit } from "@/lib/os/audit";
import { pageUpdateSchema } from "@/lib/validation";

export async function savePageAction(originalSlug: string, formData: FormData) {
  const raw = {
    slug: String(formData.get("slug") ?? originalSlug),
    title: String(formData.get("title") || ""),
    meta_description: (formData.get("meta_description") as string) || null,
    meta_keywords: (formData.get("meta_keywords") as string) || null,
    og_image_url: (formData.get("og_image_url") as string) || null,
    structured_data: (formData.get("structured_data") as string) || null,
    body_html: String(formData.get("body_html") || ""),
    is_published: formData.get("is_published") === "on",
  };

  const parsed = pageUpdateSchema.parse(raw);
  let structuredData: unknown = null;
  if (parsed.structured_data && parsed.structured_data.trim()) {
    try {
      structuredData = JSON.parse(parsed.structured_data);
    } catch {
      throw new Error("Structured data must be valid JSON");
    }
  }

  const newSlug = parsed.slug;
  const renamed = newSlug !== originalSlug;

  await withClient(async ({ session, clientId }) => {
    const sql = getDb();
    if (renamed) {
      // Ensure target slug isn't taken by another page
      const conflict = (await sql`
        SELECT id FROM site_pages WHERE client_id = ${clientId} AND slug = ${newSlug} LIMIT 1
      `) as Array<{ id: number }>;
      if (conflict[0]) throw new Error(`A page already exists at /${newSlug}`);
    }
    const result = (await sql`
      UPDATE site_pages
      SET
        slug = ${newSlug},
        title = ${parsed.title},
        meta_description = ${parsed.meta_description ?? null},
        meta_keywords = ${parsed.meta_keywords ?? null},
        og_image_url = ${parsed.og_image_url || null},
        structured_data = ${structuredData ? JSON.stringify(structuredData) : null}::jsonb,
        body_html = ${parsed.body_html},
        is_published = ${parsed.is_published ?? true},
        updated_at = NOW()
      WHERE client_id = ${clientId} AND slug = ${originalSlug}
      RETURNING id
    `) as Array<{ id: number }>;
    if (result.length === 0) throw new Error("page not found");
    if (renamed) {
      await sql`
        INSERT INTO redirects (client_id, source, destination, status_code)
        VALUES (${clientId}, ${originalSlug}, ${newSlug}, 301)
        ON CONFLICT (client_id, source) DO UPDATE SET destination = EXCLUDED.destination
      `;
      await audit(session, "page.rename", "site_page", result[0].id, { from: originalSlug, to: newSlug });
    }
    await audit(session, "page.update", "site_page", result[0].id, { slug: newSlug });
  });

  revalidatePath(`/site/${originalSlug}`);
  revalidatePath(`/site/${newSlug}`);
  if (originalSlug === "" || newSlug === "") revalidatePath("/site");
  redirect(`/os/pages/${encodeURIComponent(newSlug)}?saved=1`);
}
