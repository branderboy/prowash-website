"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { withClient } from "@/lib/os/tenancy";
import { audit } from "@/lib/os/audit";
import { slugSchema } from "@/lib/validation";

const postSchema = z.object({
  slug: slugSchema,
  title: z.string().min(1).max(200),
  excerpt: z.string().max(500).nullable().optional(),
  body_md: z.string().max(500000),
  cover_image_url: z
    .string()
    .max(500)
    .regex(/^(https?:\/\/.+|\/.+)?$/, "must be an absolute URL or a root-relative path")
    .nullable()
    .optional(),
  status: z.enum(["draft", "scheduled", "published"]),
  scheduled_for: z.string().nullable().optional(),
});

function parseForm(formData: FormData) {
  const status = String(formData.get("status") || "draft") as "draft" | "scheduled" | "published";
  return postSchema.parse({
    slug: String(formData.get("slug") || ""),
    title: String(formData.get("title") || ""),
    excerpt: (formData.get("excerpt") as string) || null,
    body_md: String(formData.get("body_md") || ""),
    cover_image_url: (formData.get("cover_image_url") as string) || null,
    status,
    scheduled_for: (formData.get("scheduled_for") as string) || null,
  });
}

export async function createPostAction(formData: FormData) {
  const parsed = parseForm(formData);
  const newSlug = await withClient(async ({ session, clientId }) => {
    const sql = getDb();
    const conflict = (await sql`
      SELECT id FROM posts WHERE client_id = ${clientId} AND slug = ${parsed.slug} LIMIT 1
    `) as Array<{ id: number }>;
    if (conflict[0]) throw new Error(`A post already exists at /blog/${parsed.slug}`);
    const publishedAt = parsed.status === "published" ? new Date() : null;
    const scheduledFor = parsed.status === "scheduled" && parsed.scheduled_for
      ? new Date(parsed.scheduled_for)
      : null;
    const rows = (await sql`
      INSERT INTO posts (client_id, slug, title, excerpt, body_md, cover_image_url, status, scheduled_for, published_at, author_id)
      VALUES (
        ${clientId}, ${parsed.slug}, ${parsed.title}, ${parsed.excerpt ?? null},
        ${parsed.body_md}, ${parsed.cover_image_url || null}, ${parsed.status},
        ${scheduledFor}, ${publishedAt}, ${session.userId}
      )
      RETURNING id, slug
    `) as Array<{ id: number; slug: string }>;
    await audit(session, "post.create", "post", rows[0].id, { slug: parsed.slug, status: parsed.status });
    return rows[0].slug;
  });
  revalidatePath("/site/blog");
  revalidatePath(`/site/blog/${newSlug}`);
  redirect(`/os/posts/${encodeURIComponent(newSlug)}?saved=1`);
}

export async function updatePostAction(originalSlug: string, formData: FormData) {
  const parsed = parseForm(formData);
  const renamed = parsed.slug !== originalSlug;
  await withClient(async ({ session, clientId }) => {
    const sql = getDb();
    if (renamed) {
      const conflict = (await sql`
        SELECT id FROM posts WHERE client_id = ${clientId} AND slug = ${parsed.slug} LIMIT 1
      `) as Array<{ id: number }>;
      if (conflict[0]) throw new Error(`A post already exists at /blog/${parsed.slug}`);
    }
    const scheduledFor = parsed.status === "scheduled" && parsed.scheduled_for
      ? new Date(parsed.scheduled_for)
      : null;
    const result = (await sql`
      UPDATE posts SET
        slug = ${parsed.slug},
        title = ${parsed.title},
        excerpt = ${parsed.excerpt ?? null},
        body_md = ${parsed.body_md},
        cover_image_url = ${parsed.cover_image_url || null},
        status = ${parsed.status},
        scheduled_for = ${scheduledFor},
        published_at = CASE
          WHEN ${parsed.status} = 'published' AND published_at IS NULL THEN NOW()
          WHEN ${parsed.status} <> 'published' THEN NULL
          ELSE published_at
        END,
        updated_at = NOW()
      WHERE client_id = ${clientId} AND slug = ${originalSlug}
      RETURNING id
    `) as Array<{ id: number }>;
    if (result.length === 0) throw new Error("post not found");
    await audit(session, "post.update", "post", result[0].id, { slug: parsed.slug, status: parsed.status });
  });
  revalidatePath("/site/blog");
  revalidatePath(`/site/blog/${originalSlug}`);
  revalidatePath(`/site/blog/${parsed.slug}`);
  redirect(`/os/posts/${encodeURIComponent(parsed.slug)}?saved=1`);
}

export async function deletePostAction(slug: string) {
  await withClient(async ({ session, clientId }) => {
    const sql = getDb();
    const result = (await sql`
      DELETE FROM posts WHERE client_id = ${clientId} AND slug = ${slug} RETURNING id
    `) as Array<{ id: number }>;
    if (result[0]) await audit(session, "post.delete", "post", result[0].id, { slug });
  });
  revalidatePath("/site/blog");
  revalidatePath(`/site/blog/${slug}`);
  redirect("/os/posts");
}
