import Link from "next/link";
import { getDb } from "@/lib/db";
import { resolveTenantClientId } from "@/lib/site/resolve-client";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

type Row = {
  slug: string;
  title: string;
  excerpt: string | null;
  cover_image_url: string | null;
  published_at: string | null;
  updated_at: string;
};

export default async function BlogIndex() {
  const clientId = await resolveTenantClientId();
  if (!clientId) {
    return <div className="container" style={{ padding: "4rem 0" }}>No tenant configured.</div>;
  }
  const sql = getDb();
  const posts = (await sql`
    SELECT slug, title, excerpt, cover_image_url, published_at, updated_at
    FROM posts
    WHERE client_id = ${clientId}
      AND status = 'published'
      AND (published_at IS NULL OR published_at <= NOW())
    ORDER BY COALESCE(published_at, updated_at) DESC
    LIMIT 50
  `) as Row[];

  return (
    <section className="section-padding">
      <div className="container">
        <div className="section-header reveal">
          <span className="section-subtitle">Latest from the team</span>
          <h1 className="section-title">BLOG</h1>
          <div className="title-divider"></div>
        </div>

        {posts.length === 0 ? (
          <p style={{ textAlign: "center", padding: "3rem 0" }}>No posts yet.</p>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "1.5rem" }}>
            {posts.map((p) => (
              <article key={p.slug} style={{ background: "#fff", borderRadius: 12, overflow: "hidden", boxShadow: "0 2px 8px rgba(0,0,0,0.05)" }}>
                {p.cover_image_url ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={p.cover_image_url} alt={p.title} style={{ width: "100%", aspectRatio: "16/9", objectFit: "cover" }} />
                ) : null}
                <div style={{ padding: "1.25rem" }}>
                  <div style={{ fontSize: "0.8rem", color: "#888" }}>
                    {formatDate(p.published_at ?? p.updated_at)}
                  </div>
                  <h3 style={{ marginTop: "0.5rem" }}>
                    <Link href={`/blog/${p.slug}`}>{p.title}</Link>
                  </h3>
                  {p.excerpt ? <p style={{ marginTop: "0.5rem" }}>{p.excerpt}</p> : null}
                  <Link href={`/blog/${p.slug}`} className="btn-add-cart" style={{ display: "inline-block", marginTop: "1rem" }}>
                    Read more
                  </Link>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
