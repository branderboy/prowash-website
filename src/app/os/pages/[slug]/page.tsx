import { notFound } from "next/navigation";
import Link from "next/link";
import { requireOsSession } from "@/lib/os/session";
import { withClient } from "@/lib/os/tenancy";
import { getDb } from "@/lib/db";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { savePageAction } from "./actions";

type Page = {
  id: number;
  slug: string;
  title: string;
  meta_description: string | null;
  meta_keywords: string | null;
  og_image_url: string | null;
  structured_data: unknown;
  body_html: string;
  is_published: boolean;
  updated_at: string;
};

async function getPage(slug: string): Promise<Page | null> {
  return withClient(async ({ clientId }) => {
    const sql = getDb();
    const rows = (await sql`
      SELECT id, slug, title, meta_description, meta_keywords, og_image_url,
             structured_data, body_html, is_published, updated_at
      FROM site_pages
      WHERE client_id = ${clientId} AND slug = ${slug}
      LIMIT 1
    `) as Page[];
    return rows[0] ?? null;
  });
}

export default async function PageEditor({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ saved?: string }>;
}) {
  await requireOsSession();
  const { slug: rawSlug } = await params;
  const sp = await searchParams;
  const slug = decodeURIComponent(rawSlug);
  const page = await getPage(slug);
  if (!page) notFound();

  const action = savePageAction.bind(null, slug);

  return (
    <div className="space-y-6">
      <div>
        <Link href="/os/pages" className="text-sm text-orange hover:underline">← All pages</Link>
        <div className="mt-2 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-navy">{page.title}</h1>
            <div className="text-xs text-navy/50 font-mono mt-1">/{page.slug}</div>
          </div>
          <a
            href={`/site/${page.slug}`}
            target="_blank"
            rel="noreferrer"
            className="text-sm text-navy/70 hover:text-orange underline"
          >
            View live →
          </a>
        </div>
      </div>

      {sp.saved ? (
        <div className="rounded-lg bg-green-50 border border-green-200 p-3 text-sm text-green-800">Saved.</div>
      ) : null}

      <form action={action} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Basics</CardTitle>
          </CardHeader>
          <CardBody className="space-y-4">
            <div>
              <Label htmlFor="title">Title</Label>
              <Input id="title" name="title" defaultValue={page.title} required className="mt-1" />
            </div>
            <div>
              <Label htmlFor="slug">URL slug</Label>
              <div className="mt-1 flex items-center gap-2">
                <span className="text-sm text-navy/50 font-mono">/</span>
                <Input
                  id="slug"
                  name="slug"
                  defaultValue={page.slug}
                  pattern="[a-z0-9\-/]*"
                  className="font-mono"
                />
              </div>
              <p className="text-xs text-navy/50 mt-1">
                Renaming creates a 301 redirect from the old URL automatically.
              </p>
            </div>
            <div>
              <Label htmlFor="meta_description">Meta description</Label>
              <Input
                id="meta_description"
                name="meta_description"
                defaultValue={page.meta_description ?? ""}
                maxLength={320}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="meta_keywords">Meta keywords</Label>
              <Input
                id="meta_keywords"
                name="meta_keywords"
                defaultValue={page.meta_keywords ?? ""}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="og_image_url">Social share image URL</Label>
              <Input
                id="og_image_url"
                name="og_image_url"
                defaultValue={page.og_image_url ?? ""}
                placeholder="/images/logo.png"
                className="mt-1"
              />
            </div>
            <label className="flex items-center gap-2 text-sm text-navy">
              <input type="checkbox" name="is_published" defaultChecked={page.is_published} />
              Published (visible on your live site)
            </label>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Body content</CardTitle>
          </CardHeader>
          <CardBody>
            <Label htmlFor="body_html">HTML</Label>
            <p className="text-xs text-navy/50 mt-1 mb-2">
              The HTML between the page header and footer. Edits here render at <code>/{page.slug}</code> on your live domain.
            </p>
            <Textarea
              id="body_html"
              name="body_html"
              defaultValue={page.body_html}
              rows={24}
              className="mt-1"
            />
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Structured data (JSON-LD)</CardTitle>
          </CardHeader>
          <CardBody>
            <Textarea
              id="structured_data"
              name="structured_data"
              defaultValue={page.structured_data ? JSON.stringify(page.structured_data, null, 2) : ""}
              rows={12}
              placeholder='{"@context":"https://schema.org",...}'
            />
            <p className="text-xs text-navy/50 mt-2">
              Optional. Will be injected as a <code>&lt;script type="application/ld+json"&gt;</code> in the page head.
            </p>
          </CardBody>
        </Card>

        <div className="flex justify-end gap-3">
          <Button type="submit" size="lg">Save & publish</Button>
        </div>
      </form>
    </div>
  );
}
