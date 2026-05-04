import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { getDb } from "@/lib/db";
import { resolveTenantClientId } from "@/lib/site/resolve-client";

type PageRow = {
  id: number;
  slug: string;
  title: string;
  meta_description: string | null;
  meta_keywords: string | null;
  og_image_url: string | null;
  structured_data: unknown;
  body_html: string;
  is_published: boolean;
};

async function loadPage(path: string[] | undefined): Promise<PageRow | null> {
  const slug = (path ?? []).join("/");
  const clientId = await resolveTenantClientId();
  if (!clientId) return null;
  const sql = getDb();
  const rows = (await sql`
    SELECT id, slug, title, meta_description, meta_keywords, og_image_url,
           structured_data, body_html, is_published
    FROM site_pages
    WHERE client_id = ${clientId} AND slug = ${slug} AND is_published = TRUE
    LIMIT 1
  `) as PageRow[];
  return rows[0] ?? null;
}

export async function generateMetadata({ params }: { params: Promise<{ path?: string[] }> }): Promise<Metadata> {
  const { path } = await params;
  const page = await loadPage(path);
  if (!page) return { title: "Not found" };
  const clientId = await resolveTenantClientId();
  let defaultOg: string | null = null;
  if (clientId) {
    const sql = getDb();
    const rows = (await sql`
      SELECT default_og_image_url FROM site_settings WHERE client_id = ${clientId} LIMIT 1
    `) as Array<{ default_og_image_url: string | null }>;
    defaultOg = rows[0]?.default_og_image_url ?? null;
  }
  const ogImage = page.og_image_url || defaultOg;
  const canonicalPath = page.slug ? `/${page.slug}` : "/";
  return {
    title: page.title,
    description: page.meta_description ?? undefined,
    keywords: page.meta_keywords ?? undefined,
    alternates: { canonical: canonicalPath },
    openGraph: {
      title: page.title,
      description: page.meta_description ?? undefined,
      url: canonicalPath,
      images: ogImage ? [{ url: ogImage }] : undefined,
      type: "website",
    },
    twitter: {
      card: ogImage ? "summary_large_image" : "summary",
      title: page.title,
      description: page.meta_description ?? undefined,
      images: ogImage ? [ogImage] : undefined,
    },
  };
}

async function loadRedirect(path: string[] | undefined): Promise<{ destination: string; status_code: number } | null> {
  const slug = (path ?? []).join("/");
  const clientId = await resolveTenantClientId();
  if (!clientId) return null;
  const sql = getDb();
  const rows = (await sql`
    SELECT destination, status_code FROM redirects
    WHERE client_id = ${clientId} AND source = ${slug}
    LIMIT 1
  `) as Array<{ destination: string; status_code: number }>;
  return rows[0] ?? null;
}

function buildBreadcrumbSchema(slug: string): Record<string, unknown> | null {
  if (!slug) return null;
  const parts = slug.split("/").filter(Boolean);
  if (parts.length === 0) return null;
  const items = [
    { "@type": "ListItem", position: 1, name: "Home", item: "/" },
  ];
  let acc = "";
  parts.forEach((part, idx) => {
    acc += `/${part}`;
    items.push({
      "@type": "ListItem",
      position: idx + 2,
      name: part
        .split("-")
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(" "),
      item: acc,
    });
  });
  return { "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: items };
}

function injectImgAttrs(html: string): string {
  // Add loading="lazy" decoding="async" to <img> tags that don't already
  // declare a loading strategy. Helps LCP/CLS without touching seed content.
  return html.replace(/<img\b([^>]*)>/g, (match, attrs) => {
    if (/\bloading\s*=/.test(attrs)) return match;
    return `<img loading="lazy" decoding="async"${attrs}>`;
  });
}

export default async function SitePage({ params }: { params: Promise<{ path?: string[] }> }) {
  const { path } = await params;
  const page = await loadPage(path);
  if (!page) {
    const r = await loadRedirect(path);
    if (r) redirect(`/${r.destination}`);
    notFound();
  }
  const breadcrumb = buildBreadcrumbSchema(page.slug);
  const body = injectImgAttrs(page.body_html);
  return (
    <>
      {page.structured_data ? (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(page.structured_data) }}
        />
      ) : null}
      {breadcrumb ? (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumb) }}
        />
      ) : null}
      <div dangerouslySetInnerHTML={{ __html: body }} />
    </>
  );
}
