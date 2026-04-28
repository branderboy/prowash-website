import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { marked } from "marked";
import { getDb } from "@/lib/db";
import { resolveTenantClientId } from "@/lib/site/resolve-client";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

type Row = {
  slug: string;
  title: string;
  excerpt: string | null;
  body_md: string;
  cover_image_url: string | null;
  published_at: string | null;
  updated_at: string;
};

async function loadPost(slug: string): Promise<Row | null> {
  const clientId = await resolveTenantClientId();
  if (!clientId) return null;
  const sql = getDb();
  const rows = (await sql`
    SELECT slug, title, excerpt, body_md, cover_image_url, published_at, updated_at
    FROM posts
    WHERE client_id = ${clientId}
      AND slug = ${slug}
      AND status = 'published'
      AND (published_at IS NULL OR published_at <= NOW())
    LIMIT 1
  `) as Row[];
  return rows[0] ?? null;
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const post = await loadPost(decodeURIComponent(slug));
  if (!post) return { title: "Not found" };
  return {
    title: post.title,
    description: post.excerpt ?? undefined,
    openGraph: {
      title: post.title,
      description: post.excerpt ?? undefined,
      images: post.cover_image_url ? [{ url: post.cover_image_url }] : undefined,
      type: "article",
    },
  };
}

export default async function BlogPostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = await loadPost(decodeURIComponent(slug));
  if (!post) notFound();
  const html = await marked.parse(post.body_md, { gfm: true, breaks: false });

  return (
    <article className="section-padding">
      <div className="container" style={{ maxWidth: 760 }}>
        <a href="/blog" style={{ color: "var(--orange, #ff6a13)", display: "inline-block", marginBottom: "1.5rem" }}>← All posts</a>
        <h1>{post.title}</h1>
        <div style={{ color: "#888", marginTop: "0.5rem" }}>
          {formatDate(post.published_at ?? post.updated_at)}
        </div>
        {post.cover_image_url ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img src={post.cover_image_url} alt={post.title} style={{ width: "100%", borderRadius: 12, marginTop: "1.5rem" }} />
        ) : null}
        <div
          style={{ marginTop: "2rem", lineHeight: 1.75 }}
          dangerouslySetInnerHTML={{ __html: html }}
        />
      </div>
    </article>
  );
}
