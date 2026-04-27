import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { getDb } from "@/lib/db";
import { resolveTenantClientId } from "@/lib/site/resolve-client";

export async function GET(req: NextRequest) {
  const clientId = await resolveTenantClientId();
  if (!clientId) {
    return new NextResponse("<?xml version=\"1.0\" encoding=\"UTF-8\"?><urlset xmlns=\"http://www.sitemaps.org/schemas/sitemap/0.9\"></urlset>", {
      headers: { "content-type": "application/xml; charset=utf-8" },
    });
  }
  const sql = getDb();
  // Cloudflare proxies the original scheme via cf-visitor:'{"scheme":"https"}'.
  // Fall back to standard x-forwarded-proto, then the request URL.
  const cfVisitor = headers().get("cf-visitor");
  let cfScheme: string | null = null;
  if (cfVisitor) {
    try {
      const parsed = JSON.parse(cfVisitor) as { scheme?: string };
      if (parsed.scheme) cfScheme = parsed.scheme;
    } catch { /* ignore malformed header */ }
  }
  const proto = cfScheme || headers().get("x-forwarded-proto") || (req.url.startsWith("https") ? "https" : "http");
  const host = headers().get("host");
  const origin = `${proto}://${host}`;

  const [pages, posts, settings] = await Promise.all([
    sql`SELECT slug, updated_at FROM site_pages WHERE client_id = ${clientId} AND is_published = TRUE ORDER BY slug` as unknown as Promise<Array<{ slug: string; updated_at: string }>>,
    sql`SELECT slug, COALESCE(published_at, updated_at) AS updated_at FROM posts WHERE client_id = ${clientId} AND status = 'published' ORDER BY slug` as unknown as Promise<Array<{ slug: string; updated_at: string }>>,
    sql`SELECT sitemap_extra_urls FROM site_settings WHERE client_id = ${clientId} LIMIT 1` as unknown as Promise<Array<{ sitemap_extra_urls: string | null }>>,
  ]);

  const urls: Array<{ loc: string; lastmod?: string }> = [];
  for (const p of pages) {
    urls.push({ loc: `${origin}/${p.slug}`, lastmod: new Date(p.updated_at).toISOString() });
  }
  for (const p of posts) {
    urls.push({ loc: `${origin}/blog/${p.slug}`, lastmod: new Date(p.updated_at).toISOString() });
  }
  const extra = settings[0]?.sitemap_extra_urls;
  if (extra) {
    for (const line of extra.split("\n").map((l) => l.trim()).filter(Boolean)) {
      urls.push({ loc: line.startsWith("http") ? line : `${origin}/${line.replace(/^\//, "")}` });
    }
  }

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map(
    (u) =>
      `  <url><loc>${escapeXml(u.loc)}</loc>${u.lastmod ? `<lastmod>${u.lastmod}</lastmod>` : ""}</url>`
  )
  .join("\n")}
</urlset>
`;
  return new NextResponse(body, { headers: { "content-type": "application/xml; charset=utf-8" } });
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
