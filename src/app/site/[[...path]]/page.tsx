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

export async function generateMetadata({ params }: { params: { path?: string[] } }): Promise<Metadata> {
  const page = await loadPage(params.path);
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
  return {
    title: page.title,
    description: page.meta_description ?? undefined,
    keywords: page.meta_keywords ?? undefined,
    openGraph: {
      title: page.title,
      description: page.meta_description ?? undefined,
      images: ogImage ? [{ url: ogImage }] : undefined,
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

export default async function SitePage({ params }: { params: { path?: string[] } }) {
  const page = await loadPage(params.path);
  if (!page) {
    const r = await loadRedirect(params.path);
    if (r) redirect(`/${r.destination}`);
    notFound();
  }
  return (
    <>
      {page.structured_data ? (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(page.structured_data) }}
        />
      ) : null}
      <div dangerouslySetInnerHTML={{ __html: page.body_html }} />
    </>
  );
}
