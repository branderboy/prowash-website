import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { resolveTenantClientId } from "@/lib/site/resolve-client";

export const dynamic = "force-dynamic";

const DEFAULT_ROBOTS = [
  "User-agent: *",
  "Allow: /",
  "Disallow: /os/",
  "Disallow: /api/",
  "Disallow: /site/checkout/",
  "",
].join("\n");

export async function GET(_req: NextRequest) {
  const clientId = await resolveTenantClientId();
  if (!clientId) {
    return new NextResponse(DEFAULT_ROBOTS, { headers: { "content-type": "text/plain" } });
  }
  const sql = getDb();
  const rows = (await sql`
    SELECT robots_txt FROM site_settings WHERE client_id = ${clientId} LIMIT 1
  `) as Array<{ robots_txt: string | null }>;
  const text = rows[0]?.robots_txt ?? DEFAULT_ROBOTS;
  return new NextResponse(text, { headers: { "content-type": "text/plain; charset=utf-8" } });
}
