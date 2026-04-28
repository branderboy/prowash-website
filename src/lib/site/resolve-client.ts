import { cache } from "react";
import { headers } from "next/headers";
import { getDb } from "@/lib/db";

/**
 * Resolve which tenant owns the current request, by host. Returns null in
 * production when no domain matches (callers turn that into a 404). The
 * first-client fallback is dev-only — keeping it on in prod would let an
 * unmapped custom domain serve another tenant's content.
 */
export const resolveTenantClientId = cache(async (): Promise<number | null> => {
  const sql = getDb();
  const host = (headers().get("host") || "").split(":")[0].toLowerCase();
  if (host) {
    const rows = (await sql`
      SELECT client_id FROM domains WHERE host = ${host} LIMIT 1
    `) as Array<{ client_id: number }>;
    if (rows[0]) return rows[0].client_id;
    if (host.startsWith("www.")) {
      const stripped = host.slice(4);
      const rows2 = (await sql`SELECT client_id FROM domains WHERE host = ${stripped} LIMIT 1`) as Array<{ client_id: number }>;
      if (rows2[0]) return rows2[0].client_id;
    }
  }
  if (process.env.NODE_ENV !== "production") {
    const fallback = (await sql`SELECT id FROM clients ORDER BY id ASC LIMIT 1`) as Array<{ id: number }>;
    return fallback[0]?.id ?? null;
  }
  return null;
});
