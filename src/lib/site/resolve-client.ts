import { headers } from "next/headers";
import { getDb } from "@/lib/db";

/**
 * Resolve which tenant owns the current request, by host. Falls back to the
 * first client (dev convenience) when no domain matches — never trust this
 * fallback in production after multi-tenant goes live.
 */
export async function resolveTenantClientId(): Promise<number | null> {
  const sql = getDb();
  const host = (headers().get("host") || "").split(":")[0].toLowerCase();
  if (host) {
    const rows = (await sql`
      SELECT client_id FROM domains WHERE host = ${host} LIMIT 1
    `) as Array<{ client_id: number }>;
    if (rows[0]) return rows[0].client_id;
    // try www stripping
    if (host.startsWith("www.")) {
      const stripped = host.slice(4);
      const rows2 = (await sql`SELECT client_id FROM domains WHERE host = ${stripped} LIMIT 1`) as Array<{ client_id: number }>;
      if (rows2[0]) return rows2[0].client_id;
    }
  }
  // Dev fallback: first client by id
  const fallback = (await sql`SELECT id FROM clients ORDER BY id ASC LIMIT 1`) as Array<{ id: number }>;
  return fallback[0]?.id ?? null;
}
