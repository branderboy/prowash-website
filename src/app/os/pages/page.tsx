import Link from "next/link";
import { requireOsSession } from "@/lib/os/session";
import { withClient } from "@/lib/os/tenancy";
import { getDb } from "@/lib/db";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate } from "@/lib/utils";

async function listPages() {
  return withClient(async ({ clientId }) => {
    const sql = getDb();
    return (await sql`
      SELECT id, slug, title, is_published, updated_at
      FROM site_pages
      WHERE client_id = ${clientId}
      ORDER BY slug ASC
    `) as Array<{ id: number; slug: string; title: string; is_published: boolean; updated_at: string }>;
  });
}

export default async function PagesIndex() {
  requireOsSession();
  const pages = await listPages();

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold text-navy">Pages</h1>
          <p className="text-sm text-navy/60 mt-1">Edit the copy, meta, and structured data on each page of your site.</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Site pages</CardTitle>
        </CardHeader>
        <CardBody className="p-0">
          {pages.length === 0 ? (
            <div className="p-8 text-center text-sm text-navy/60">
              No pages yet. Run the Prowash seed (POST /api/admin/seed-prowash) to import your existing site.
            </div>
          ) : (
            <ul className="divide-y divide-navy/5">
              {pages.map((p) => (
                <li key={p.id} className="flex items-center justify-between px-5 py-3">
                  <div>
                    <Link
                      href={`/os/pages/${encodeURIComponent(p.slug)}`}
                      className="font-medium text-navy hover:text-orange"
                    >
                      {p.title}
                    </Link>
                    <div className="text-xs text-navy/50 font-mono">/{p.slug}</div>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-navy/60">
                    <span
                      className={
                        p.is_published
                          ? "px-2 py-0.5 rounded bg-green-50 text-green-700"
                          : "px-2 py-0.5 rounded bg-amber-50 text-amber-700"
                      }
                    >
                      {p.is_published ? "Published" : "Draft"}
                    </span>
                    <span>{formatDate(p.updated_at)}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
