import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { resolveTenantClientId } from "@/lib/site/resolve-client";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest) {
  const clientId = await resolveTenantClientId();
  if (!clientId) {
    return new NextResponse("User-agent: *\nAllow: /\n", { headers: { "content-type": "text/plain" } });
  }
  const sql = getDb();
  const rows = (await sql`
    SELECT robots_txt FROM site_settings WHERE client_id = ${clientId} LIMIT 1
  `) as Array<{ robots_txt: string | null }>;
  const text = rows[0]?.robots_txt ?? "User-agent: *\nAllow: /\n";
  return new NextResponse(text, { headers: { "content-type": "text/plain; charset=utf-8" } });
}
