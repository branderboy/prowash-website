"use server";

import { revalidatePath } from "next/cache";
import { put, del } from "@vercel/blob";
import { getDb } from "@/lib/db";
import { withClient } from "@/lib/os/tenancy";
import { audit } from "@/lib/os/audit";

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB
const ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/svg+xml",
  "image/avif",
]);

export async function uploadMediaAction(formData: FormData) {
  const file = formData.get("file");
  const altText = String(formData.get("alt_text") || "") || null;
  if (!(file instanceof File) || file.size === 0) {
    throw new Error("No file selected");
  }
  if (file.size > MAX_BYTES) {
    throw new Error(`File too large (max ${MAX_BYTES / 1024 / 1024}MB)`);
  }
  if (!ALLOWED_TYPES.has(file.type)) {
    throw new Error(`Unsupported file type: ${file.type}`);
  }
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    throw new Error("BLOB_READ_WRITE_TOKEN env var is not set");
  }

  await withClient(async ({ session, clientId }) => {
    const sql = getDb();
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const key = `tenants/${clientId}/${Date.now()}-${safeName}`;
    const blob = await put(key, file, { access: "public", addRandomSuffix: false });
    const rows = (await sql`
      INSERT INTO media (client_id, url, filename, mime_type, size_bytes, alt_text, uploaded_by)
      VALUES (${clientId}, ${blob.url}, ${file.name}, ${file.type}, ${file.size}, ${altText}, ${session.userId})
      RETURNING id
    `) as Array<{ id: number }>;
    await audit(session, "media.upload", "media", rows[0].id, {
      filename: file.name,
      size: file.size,
    });
  });
  revalidatePath("/os/media");
}

export async function deleteMediaAction(id: number) {
  await withClient(async ({ session, clientId }) => {
    const sql = getDb();
    const rows = (await sql`
      SELECT url FROM media WHERE id = ${id} AND client_id = ${clientId} LIMIT 1
    `) as Array<{ url: string }>;
    if (!rows[0]) return;
    try {
      await del(rows[0].url);
    } catch {
      // Blob may already be gone — keep going to clear the DB row.
    }
    await sql`DELETE FROM media WHERE id = ${id} AND client_id = ${clientId}`;
    await audit(session, "media.delete", "media", id);
  });
  revalidatePath("/os/media");
}
