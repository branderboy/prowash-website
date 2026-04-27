import { getDb } from "@/lib/db";
import { getCloudflareCreds, verifyCloudflare } from "@/lib/cloudflare";

export type Severity = "error" | "warning" | "info";

export type HealthCheck = {
  id: string;
  severity: Severity;
  title: string;
  detail?: string;
  link?: { href: string; label: string };
};

export type HealthReport = {
  ranAt: string;
  checks: HealthCheck[];
  summary: { error: number; warning: number; info: number; ok: number };
};

const TEXT_TABLES = [
  "clients",
  "domains",
  "users",
  "memberships",
  "site_pages",
  "site_settings",
  "redirects",
  "products",
  "audit_log",
];

export async function runHealthChecks(clientId: number): Promise<HealthReport> {
  const sql = getDb();
  const checks: HealthCheck[] = [];

  // 1. Schema sanity — every table is reachable
  let schemaOk = 0;
  for (const t of TEXT_TABLES) {
    try {
      await (sql as unknown as (q: string) => Promise<unknown>)(`SELECT 1 FROM ${t} LIMIT 1`);
      schemaOk++;
    } catch (err) {
      checks.push({
        id: `schema:${t}`,
        severity: "error",
        title: `Table ${t} is missing or unreachable`,
        detail: err instanceof Error ? err.message : String(err),
        link: { href: "/os/settings", label: "Run /api/admin/setup" },
      });
    }
  }

  // 2. Domains mapping
  const domains = (await sql`SELECT host FROM domains WHERE client_id = ${clientId}`) as Array<{ host: string }>;
  if (domains.length === 0) {
    checks.push({
      id: "domains:none",
      severity: "warning",
      title: "No domains mapped to this client",
      detail: "Without a row in `domains`, custom-host requests can't resolve to this tenant.",
    });
  }

  // 3. Site settings present
  const settings = (await sql`
    SELECT favicon_url, default_og_image_url, robots_txt, primary_phone FROM site_settings WHERE client_id = ${clientId} LIMIT 1
  `) as Array<{ favicon_url: string | null; default_og_image_url: string | null; robots_txt: string | null; primary_phone: string | null }>;
  const s = settings[0];
  if (!s) {
    checks.push({
      id: "settings:missing",
      severity: "warning",
      title: "No site_settings row",
      link: { href: "/os/settings", label: "Open settings" },
    });
  } else {
    if (!s.favicon_url) checks.push({ id: "settings:favicon", severity: "info", title: "No favicon set", link: { href: "/os/settings", label: "Add favicon" } });
    if (!s.default_og_image_url) checks.push({ id: "settings:og", severity: "info", title: "No default social share image", link: { href: "/os/settings", label: "Add default OG image" } });
    if (!s.robots_txt) checks.push({ id: "settings:robots", severity: "info", title: "robots.txt is empty (default served)", link: { href: "/os/seo", label: "Edit robots.txt" } });
  }

  // 4. Site pages content health
  type PageRow = {
    id: number;
    slug: string;
    title: string | null;
    meta_description: string | null;
    og_image_url: string | null;
    body_html: string;
    is_published: boolean;
    structured_data: unknown;
  };
  const pages = (await sql`
    SELECT id, slug, title, meta_description, og_image_url, body_html, is_published, structured_data
    FROM site_pages WHERE client_id = ${clientId}
  `) as PageRow[];

  if (pages.length === 0) {
    checks.push({
      id: "pages:none",
      severity: "warning",
      title: "No site pages",
      detail: "Run /api/admin/seed-prowash to import the legacy HTML pages.",
    });
  }

  const slugSet = new Set(pages.map((p) => p.slug));
  const publishedSlugs = new Set(pages.filter((p) => p.is_published).map((p) => p.slug));

  // Required pages — common slugs people expect to exist
  const expectedSlugs = ["", "about", "contact", "faq"];
  for (const slug of expectedSlugs) {
    if (!slugSet.has(slug)) {
      checks.push({
        id: `pages:expected:${slug || "home"}`,
        severity: "warning",
        title: `Expected page missing: /${slug}`,
        detail: "Most sites expect this URL to render. Create the page or add a redirect.",
        link: { href: "/os/pages", label: "Open pages" },
      });
    }
  }

  for (const p of pages) {
    const where = `/os/pages/${encodeURIComponent(p.slug)}`;
    if (!p.title || !p.title.trim()) {
      checks.push({ id: `page:title:${p.id}`, severity: "error", title: `Page /${p.slug} has no title`, link: { href: where, label: "Edit" } });
    }
    if (!p.meta_description || !p.meta_description.trim()) {
      checks.push({ id: `page:meta:${p.id}`, severity: "warning", title: `Page /${p.slug} has no meta description`, link: { href: where, label: "Edit" } });
    } else if (p.meta_description.length > 160) {
      checks.push({ id: `page:meta-long:${p.id}`, severity: "info", title: `Page /${p.slug} meta description is long (${p.meta_description.length} chars)`, link: { href: where, label: "Edit" } });
    }
    if (!p.body_html || !p.body_html.trim()) {
      checks.push({ id: `page:empty:${p.id}`, severity: "error", title: `Page /${p.slug} has no body content`, link: { href: where, label: "Edit" } });
    }
    if (!p.og_image_url && !s?.default_og_image_url) {
      checks.push({ id: `page:og:${p.id}`, severity: "info", title: `Page /${p.slug} has no social share image`, link: { href: where, label: "Edit" } });
    }
  }

  // 5. Internal-link audit — find href="/path" inside body_html and ensure
  // each target resolves to a page slug or a redirect.
  const redirects = (await sql`SELECT source FROM redirects WHERE client_id = ${clientId}`) as Array<{ source: string }>;
  const redirectSet = new Set(redirects.map((r) => r.source));
  const linkRegex = /href="\/([a-z0-9\-/]*)"/gi;
  const seenBroken = new Set<string>();
  for (const p of pages) {
    if (!p.body_html) continue;
    const matches = p.body_html.matchAll(linkRegex);
    for (const m of matches) {
      const target = (m[1] || "").replace(/\/$/, "");
      if (target === "" && publishedSlugs.has("")) continue;
      if (target.includes("#") || target.includes("?")) continue;
      if (target.startsWith("blog/")) continue;
      if (publishedSlugs.has(target) || redirectSet.has(target)) continue;
      const key = `link:${target}`;
      if (seenBroken.has(key)) continue;
      seenBroken.add(key);
      checks.push({
        id: `link:${target}`,
        severity: "warning",
        title: `Broken internal link: /${target}`,
        detail: `Linked from /${p.slug}. Target page or redirect not found.`,
        link: { href: `/os/pages/${encodeURIComponent(p.slug)}`, label: `Open /${p.slug}` },
      });
    }
  }

  // 6. Stripe — products without sync IDs
  const unsynced = (await sql`
    SELECT COUNT(*)::int AS n FROM products
    WHERE client_id = ${clientId} AND active = TRUE AND stripe_product_id IS NULL
  `) as Array<{ n: number }>;
  if ((unsynced[0]?.n ?? 0) > 0) {
    checks.push({
      id: "stripe:unsynced",
      severity: "warning",
      title: `${unsynced[0].n} active product${unsynced[0].n === 1 ? "" : "s"} not synced to Stripe`,
      detail: "Add your Stripe key in Settings, then re-save each product.",
      link: { href: "/os/settings", label: "Connect Stripe" },
    });
  }

  // 7. Cloudflare — info if missing, verify if present
  const cf = await getCloudflareCreds(clientId);
  if (!cf) {
    checks.push({
      id: "cloudflare:none",
      severity: "info",
      title: "Cloudflare not connected",
      detail: "Connect Cloudflare so Clear cache can purge the CDN as well.",
      link: { href: "/os/settings", label: "Connect Cloudflare" },
    });
  } else {
    const v = await verifyCloudflare(cf);
    if (v.ok) {
      checks.push({
        id: "cloudflare:ok",
        severity: "info",
        title: `Cloudflare connected (${v.name})`,
      });
    } else {
      checks.push({
        id: "cloudflare:invalid",
        severity: "error",
        title: "Cloudflare credentials invalid",
        detail: v.error,
        link: { href: "/os/settings", label: "Update Cloudflare" },
      });
    }
  }

  // 8. Audit log volume (pure info)
  const auditCount = (await sql`SELECT COUNT(*)::int AS n FROM audit_log WHERE client_id = ${clientId}`) as Array<{ n: number }>;
  checks.push({
    id: "audit:count",
    severity: "info",
    title: `${auditCount[0]?.n ?? 0} audit events recorded`,
  });

  const summary = checks.reduce(
    (acc, c) => {
      acc[c.severity]++;
      return acc;
    },
    { error: 0, warning: 0, info: 0, ok: 0 } as HealthReport["summary"]
  );
  summary.ok = schemaOk;

  return { ranAt: new Date().toISOString(), checks, summary };
}
