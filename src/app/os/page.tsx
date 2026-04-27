import Link from "next/link";
import { requireOsSession } from "@/lib/os/session";
import { withClient } from "@/lib/os/tenancy";
import { getDb } from "@/lib/db";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate } from "@/lib/utils";

async function getStats() {
  return withClient(async ({ clientId }) => {
    const sql = getDb();
    const [pages, posts, recent] = await Promise.all([
      sql`SELECT COUNT(*)::int AS n FROM site_pages WHERE client_id = ${clientId}` as unknown as Promise<Array<{ n: number }>>,
      sql`SELECT COUNT(*)::int AS n FROM posts WHERE client_id = ${clientId} AND status = 'published'` as unknown as Promise<Array<{ n: number }>>,
      sql`
        SELECT slug, title, updated_at FROM site_pages
        WHERE client_id = ${clientId}
        ORDER BY updated_at DESC
        LIMIT 5
      ` as unknown as Promise<Array<{ slug: string; title: string; updated_at: string }>>,
    ]);
    return { pageCount: pages[0]?.n ?? 0, publishedPosts: posts[0]?.n ?? 0, recent };
  });
}

export default async function OsHome() {
  requireOsSession();
  const stats = await getStats();
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-navy">Dashboard</h1>
        <p className="text-sm text-navy/60 mt-1">
          Manage your site content. Changes you publish here render on your live domain.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardBody>
            <div className="text-xs uppercase text-navy/50">Pages</div>
            <div className="text-3xl font-bold mt-1">{stats.pageCount}</div>
            <Link href="/os/pages" className="text-sm text-orange hover:underline mt-2 inline-block">
              Manage pages →
            </Link>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <div className="text-xs uppercase text-navy/50">Published Posts</div>
            <div className="text-3xl font-bold mt-1">{stats.publishedPosts}</div>
            <Link href="/os/posts" className="text-sm text-orange hover:underline mt-2 inline-block">
              Manage blog →
            </Link>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <div className="text-xs uppercase text-navy/50">Live Site</div>
            <div className="text-sm mt-2 text-navy/70">
              Your edits show up at your custom domain via the public render path.
            </div>
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent page edits</CardTitle>
        </CardHeader>
        <CardBody>
          {stats.recent.length === 0 ? (
            <p className="text-sm text-navy/60">No pages yet. They'll show up here once you have site content.</p>
          ) : (
            <ul className="divide-y divide-navy/5">
              {stats.recent.map((p) => (
                <li key={p.slug} className="py-3 flex items-center justify-between">
                  <div>
                    <Link href={`/os/pages/${encodeURIComponent(p.slug)}`} className="font-medium text-navy hover:text-orange">
                      {p.title}
                    </Link>
                    <div className="text-xs text-navy/50">/{p.slug || ""}</div>
                  </div>
                  <div className="text-xs text-navy/50">{formatDate(p.updated_at)}</div>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
