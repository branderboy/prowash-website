import Link from "next/link";
import { requireOsSession } from "@/lib/os/session";
import { withClient } from "@/lib/os/tenancy";
import { getDb } from "@/lib/db";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate } from "@/lib/utils";
import { runHealthChecks } from "@/lib/os/health";

export const dynamic = "force-dynamic";

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
  await requireOsSession();
  const [stats, health] = await Promise.all([
    getStats(),
    withClient(({ clientId }) => runHealthChecks(clientId)),
  ]);

  const errorCount = health.summary.error;
  const warningCount = health.summary.warning;
  const totalIssues = errorCount + warningCount;
  const topIssues = health.checks
    .filter((c) => c.severity === "error" || c.severity === "warning")
    .slice(0, 5);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-navy">Dashboard</h1>
        <p className="text-sm text-navy/60 mt-1">
          Manage your site content. Changes you publish here render on your live domain.
        </p>
      </div>

      {totalIssues > 0 ? (
        <div
          className={`rounded-lg border p-4 flex items-center justify-between ${
            errorCount > 0
              ? "bg-red-50 border-red-200 text-red-900"
              : "bg-amber-50 border-amber-200 text-amber-900"
          }`}
        >
          <div>
            <div className="font-semibold">
              {errorCount > 0
                ? `${errorCount} error${errorCount === 1 ? "" : "s"} need attention`
                : `${warningCount} warning${warningCount === 1 ? "" : "s"} to review`}
            </div>
            <div className="text-sm opacity-80">
              {errorCount > 0 && warningCount > 0
                ? `Plus ${warningCount} warning${warningCount === 1 ? "" : "s"}.`
                : null}
            </div>
          </div>
          <Link href="/os/health" className="text-sm font-medium underline hover:no-underline">
            View Health →
          </Link>
        </div>
      ) : (
        <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-green-800 flex items-center justify-between">
          <div className="font-semibold">All systems healthy</div>
          <Link href="/os/health" className="text-sm font-medium underline hover:no-underline">
            View Health →
          </Link>
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card>
          <CardBody>
            <div className="text-xs uppercase text-navy/50">Pages</div>
            <div className="text-3xl font-bold mt-1">{stats.pageCount}</div>
            <Link href="/os/pages" className="text-sm text-orange hover:underline mt-2 inline-block">
              Manage →
            </Link>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <div className="text-xs uppercase text-navy/50">Posts</div>
            <div className="text-3xl font-bold mt-1">{stats.publishedPosts}</div>
            <Link href="/os/posts" className="text-sm text-orange hover:underline mt-2 inline-block">
              Manage →
            </Link>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <div className="text-xs uppercase text-navy/50">Errors</div>
            <div className={`text-3xl font-bold mt-1 ${errorCount > 0 ? "text-red-700" : "text-navy/60"}`}>
              {errorCount}
            </div>
            <Link href="/os/health" className="text-sm text-orange hover:underline mt-2 inline-block">
              View →
            </Link>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <div className="text-xs uppercase text-navy/50">Warnings</div>
            <div className={`text-3xl font-bold mt-1 ${warningCount > 0 ? "text-amber-700" : "text-navy/60"}`}>
              {warningCount}
            </div>
            <Link href="/os/health" className="text-sm text-orange hover:underline mt-2 inline-block">
              View →
            </Link>
          </CardBody>
        </Card>
      </div>

      {topIssues.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Top issues</CardTitle>
          </CardHeader>
          <CardBody className="p-0">
            <ul className="divide-y divide-navy/5">
              {topIssues.map((c) => (
                <li key={c.id} className="px-5 py-3 flex items-start gap-3">
                  <span
                    className={`mt-2 h-2 w-2 rounded-full ${
                      c.severity === "error" ? "bg-red-500" : "bg-amber-500"
                    }`}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-navy">{c.title}</div>
                    {c.detail ? <p className="text-sm text-navy/60 mt-0.5">{c.detail}</p> : null}
                  </div>
                  {c.link ? (
                    <Link href={c.link.href} className="text-sm text-orange hover:underline whitespace-nowrap">
                      {c.link.label} →
                    </Link>
                  ) : null}
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      ) : null}

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
