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
import { updatePostAction, deletePostAction } from "../actions";

type Post = {
  id: number;
  slug: string;
  title: string;
  excerpt: string | null;
  body_md: string;
  cover_image_url: string | null;
  status: "draft" | "scheduled" | "published";
  scheduled_for: string | null;
  published_at: string | null;
};

async function getPost(slug: string): Promise<Post | null> {
  return withClient(async ({ clientId }) => {
    const sql = getDb();
    const rows = (await sql`
      SELECT id, slug, title, excerpt, body_md, cover_image_url, status,
             scheduled_for, published_at
      FROM posts
      WHERE client_id = ${clientId} AND slug = ${slug}
      LIMIT 1
    `) as Post[];
    return rows[0] ?? null;
  });
}

function toDatetimeLocal(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default async function PostEditor({
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
  const post = await getPost(slug);
  if (!post) notFound();

  const update = updatePostAction.bind(null, slug);
  const remove = deletePostAction.bind(null, slug);

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <Link href="/os/posts" className="text-sm text-orange hover:underline">← Posts</Link>
        <div className="mt-2 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-navy">{post.title}</h1>
            <div className="text-xs text-navy/50 font-mono mt-1">/blog/{post.slug}</div>
          </div>
          {post.status === "published" ? (
            <a href={`/blog/${post.slug}`} target="_blank" rel="noreferrer" className="text-sm text-navy/70 hover:text-orange underline">
              View live →
            </a>
          ) : null}
        </div>
      </div>

      {sp.saved ? (
        <div className="rounded-lg bg-green-50 border border-green-200 p-3 text-sm text-green-800">Saved.</div>
      ) : null}

      <form action={update} className="space-y-6">
        <Card>
          <CardHeader><CardTitle>Basics</CardTitle></CardHeader>
          <CardBody className="space-y-4">
            <div>
              <Label htmlFor="title">Title</Label>
              <Input id="title" name="title" defaultValue={post.title} required maxLength={200} className="mt-1" />
            </div>
            <div>
              <Label htmlFor="slug">URL slug</Label>
              <div className="mt-1 flex items-center gap-2">
                <span className="text-sm text-navy/50 font-mono">/blog/</span>
                <Input id="slug" name="slug" defaultValue={post.slug} pattern="[a-z0-9\-/]+" required className="font-mono" />
              </div>
            </div>
            <div>
              <Label htmlFor="excerpt">Excerpt</Label>
              <Textarea id="excerpt" name="excerpt" rows={3} maxLength={500} defaultValue={post.excerpt ?? ""} />
            </div>
            <div>
              <Label htmlFor="cover_image_url">Cover image URL</Label>
              <Input id="cover_image_url" name="cover_image_url" defaultValue={post.cover_image_url ?? ""} className="mt-1" />
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader><CardTitle>Body (Markdown)</CardTitle></CardHeader>
          <CardBody>
            <Textarea name="body_md" rows={24} defaultValue={post.body_md} required />
          </CardBody>
        </Card>

        <Card>
          <CardHeader><CardTitle>Publishing</CardTitle></CardHeader>
          <CardBody className="space-y-4">
            <div>
              <Label htmlFor="status">Status</Label>
              <select
                id="status"
                name="status"
                defaultValue={post.status}
                className="mt-1 w-full rounded-lg border border-navy/15 bg-white px-3 py-2 text-sm"
              >
                <option value="draft">Draft</option>
                <option value="scheduled">Scheduled</option>
                <option value="published">Published</option>
              </select>
            </div>
            <div>
              <Label htmlFor="scheduled_for">Scheduled for</Label>
              <Input
                id="scheduled_for"
                name="scheduled_for"
                type="datetime-local"
                defaultValue={toDatetimeLocal(post.scheduled_for)}
                className="mt-1"
              />
            </div>
          </CardBody>
        </Card>

        <div className="flex justify-end gap-3">
          <Button type="submit" size="lg">Save</Button>
        </div>
      </form>

      <form action={remove}>
        <button className="text-red-600 text-sm hover:underline" type="submit">
          Delete post
        </button>
      </form>
    </div>
  );
}
