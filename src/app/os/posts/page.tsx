import { requireOsSession } from "@/lib/os/session";
import { withClient } from "@/lib/os/tenancy";
import { getDb } from "@/lib/db";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

async function listPosts() {
  return withClient(async ({ clientId }) => {
    const sql = getDb();
    return (await sql`
      SELECT id, slug, title, status, published_at, updated_at
      FROM posts
      WHERE client_id = ${clientId}
      ORDER BY COALESCE(published_at, updated_at) DESC
    `) as Array<{ id: number; slug: string; title: string; status: string; published_at: string | null; updated_at: string }>;
  });
}

export default async function PostsIndex() {
  await requireOsSession();
  const posts = await listPosts();
  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold text-navy">Blog Posts</h1>
          <p className="text-sm text-navy/60 mt-1">Write, schedule, and publish posts. They render at /blog/&lt;slug&gt; on your live site.</p>
        </div>
        <Link href="/os/posts/new">
          <Button>New post</Button>
        </Link>
      </div>
      <Card>
        <CardHeader><CardTitle>Posts</CardTitle></CardHeader>
        <CardBody className="p-0">
          {posts.length === 0 ? (
            <div className="p-8 text-center text-sm text-navy/60">
              No posts yet. Click <strong>New post</strong> to write your first one.
            </div>
          ) : (
            <ul className="divide-y divide-navy/5">
              {posts.map((p) => (
                <li key={p.id} className="px-5 py-3 flex items-center justify-between">
                  <div>
                    <Link href={`/os/posts/${encodeURIComponent(p.slug)}`} className="font-medium text-navy hover:text-orange">
                      {p.title}
                    </Link>
                    <div className="text-xs text-navy/50 font-mono">/blog/{p.slug}</div>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-navy/60">
                    <span
                      className={
                        p.status === "published"
                          ? "px-2 py-0.5 rounded bg-green-50 text-green-700"
                          : p.status === "scheduled"
                          ? "px-2 py-0.5 rounded bg-blue-50 text-blue-700"
                          : "px-2 py-0.5 rounded bg-amber-50 text-amber-700"
                      }
                    >
                      {p.status}
                    </span>
                    <span>{p.published_at ? formatDate(p.published_at) : formatDate(p.updated_at)}</span>
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
