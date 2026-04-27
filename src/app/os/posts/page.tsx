import { requireOsSession } from "@/lib/os/session";
import { withClient } from "@/lib/os/tenancy";
import { getDb } from "@/lib/db";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import { formatDate } from "@/lib/utils";

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
  requireOsSession();
  const posts = await listPosts();
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-navy">Blog Posts</h1>
        <p className="text-sm text-navy/60 mt-1">Write, schedule, and publish posts. They render at /blog/&lt;slug&gt; on your live site.</p>
      </div>
      <Card>
        <CardHeader><CardTitle>Posts</CardTitle></CardHeader>
        <CardBody className="p-0">
          {posts.length === 0 ? (
            <div className="p-8 text-center text-sm text-navy/60">
              No posts yet. The post editor is coming next — schema is ready and the public render path will read from the <code>posts</code> table.
            </div>
          ) : (
            <ul className="divide-y divide-navy/5">
              {posts.map((p) => (
                <li key={p.id} className="px-5 py-3 flex items-center justify-between">
                  <div>
                    <div className="font-medium">{p.title}</div>
                    <div className="text-xs text-navy/50 font-mono">/blog/{p.slug}</div>
                  </div>
                  <div className="text-xs text-navy/60">
                    <span className="mr-3 capitalize">{p.status}</span>
                    {p.published_at ? formatDate(p.published_at) : formatDate(p.updated_at)}
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
