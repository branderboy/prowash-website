import Link from "next/link";
import { requireOsSession } from "@/lib/os/session";
import { withClient } from "@/lib/os/tenancy";
import { getDb } from "@/lib/db";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { saveSeoAction, deleteRedirectAction } from "./actions";

async function load() {
  return withClient(async ({ clientId }) => {
    const sql = getDb();
    const [settings, redirects, primaryHost] = await Promise.all([
      sql`SELECT robots_txt, sitemap_extra_urls FROM site_settings WHERE client_id = ${clientId} LIMIT 1` as unknown as Promise<Array<{ robots_txt: string | null; sitemap_extra_urls: string | null }>>,
      sql`SELECT id, source, destination, status_code FROM redirects WHERE client_id = ${clientId} ORDER BY source` as unknown as Promise<Array<{ id: number; source: string; destination: string; status_code: number }>>,
      sql`SELECT primary_host FROM clients WHERE id = ${clientId}` as unknown as Promise<Array<{ primary_host: string | null }>>,
    ]);
    return {
      robots: settings[0]?.robots_txt ?? `User-agent: *\nAllow: /\n`,
      sitemapExtras: settings[0]?.sitemap_extra_urls ?? "",
      redirects,
      primaryHost: primaryHost[0]?.primary_host ?? null,
    };
  });
}

export default async function SeoPage() {
  requireOsSession();
  const data = await load();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-navy">SEO</h1>
        <p className="text-sm text-navy/60 mt-1">
          Manage robots.txt, the auto-generated sitemap, and URL redirects. Per-page meta and structured data live in
          <Link href="/os/pages" className="text-orange hover:underline"> Pages</Link>.
        </p>
      </div>

      <form action={saveSeoAction} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>robots.txt</CardTitle>
          </CardHeader>
          <CardBody>
            <p className="text-xs text-navy/60 mb-2">
              Served at <code>{data.primaryHost ? `https://${data.primaryHost}` : ""}/robots.txt</code>.
            </p>
            <Textarea name="robots_txt" defaultValue={data.robots} rows={10} />
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Sitemap extras</CardTitle>
          </CardHeader>
          <CardBody>
            <p className="text-xs text-navy/60 mb-2">
              Auto-generated from your published pages and blog posts. Add extra URLs (one per line) here if you want
              them included.
            </p>
            <Textarea name="sitemap_extra_urls" defaultValue={data.sitemapExtras} rows={6} placeholder="/extra-page" />
            <div className="mt-3 text-xs">
              <a
                href="/sitemap.xml"
                target="_blank"
                rel="noreferrer"
                className="text-orange hover:underline"
              >
                View sitemap.xml →
              </a>
            </div>
          </CardBody>
        </Card>

        <div className="flex justify-end">
          <Button type="submit" size="lg">Save SEO settings</Button>
        </div>
      </form>

      <Card>
        <CardHeader>
          <CardTitle>URL redirects</CardTitle>
        </CardHeader>
        <CardBody>
          <p className="text-xs text-navy/60 mb-3">
            Created automatically when you rename a page slug. You can also add or delete entries here.
          </p>
          {data.redirects.length === 0 ? (
            <p className="text-sm text-navy/60">No redirects yet.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-navy/60 uppercase">
                <tr>
                  <th className="py-2">From</th>
                  <th className="py-2">To</th>
                  <th className="py-2">Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-navy/5">
                {data.redirects.map((r) => (
                  <tr key={r.id}>
                    <td className="py-2 font-mono">/{r.source}</td>
                    <td className="py-2 font-mono">/{r.destination}</td>
                    <td className="py-2">{r.status_code}</td>
                    <td className="py-2 text-right">
                      <form action={deleteRedirectAction.bind(null, r.id)}>
                        <button className="text-red-600 hover:underline text-xs">Delete</button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
