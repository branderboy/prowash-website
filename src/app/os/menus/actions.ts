"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getDb } from "@/lib/db";
import { withClient } from "@/lib/os/tenancy";
import { audit } from "@/lib/os/audit";

export async function saveMenuAction(location: "header" | "footer", formData: FormData) {
  const json = String(formData.get("items") || "[]");
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new Error("Menu items must be valid JSON");
  }
  if (!Array.isArray(parsed)) throw new Error("Menu items must be a JSON array");

  await withClient(async ({ session, clientId }) => {
    const sql = getDb();
    await sql`
      INSERT INTO menus (client_id, location, items)
      VALUES (${clientId}, ${location}, ${JSON.stringify(parsed)}::jsonb)
      ON CONFLICT (client_id, location) DO UPDATE SET items = EXCLUDED.items, updated_at = NOW()
    `;
    await audit(session, "menu.update", "menu", `${clientId}:${location}`);
  });
  revalidatePath("/site");
  redirect("/os/menus?saved=1");
}
