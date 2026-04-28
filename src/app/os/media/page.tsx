import { requireOsSession } from "@/lib/os/session";
import { withClient } from "@/lib/os/tenancy";
import { getDb } from "@/lib/db";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { uploadMediaAction, deleteMediaAction } from "./actions";

export const dynamic = "force-dynamic";

type Row = {
  id: number;
  url: string;
  filename: string;
  mime_type: string | null;
  size_bytes: number | null;
  alt_text: string | null;
  created_at: string;
};

async function listMedia() {
  return withClient(async ({ clientId }) => {
    const sql = getDb();
    return (await sql`
      SELECT id, url, filename, mime_type, size_bytes, alt_text, created_at
      FROM media
      WHERE client_id = ${clientId}
      ORDER BY created_at DESC
      LIMIT 200
    `) as Row[];
  });
}

function fmtSize(b: number | null): string {
  if (!b) return "";
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1024 / 1024).toFixed(1)} MB`;
}

export default async function MediaPage() {
  await requireOsSession();
  const items = await listMedia();
  const blobConfigured = Boolean(process.env.BLOB_READ_WRITE_TOKEN);
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-navy">Media library</h1>
        <p className="text-sm text-navy/60 mt-1">
          Upload images and copy the URL to use in pages, posts, or product images.
        </p>
      </div>

      <Card>
        <CardHeader><CardTitle>Upload</CardTitle></CardHeader>
        <CardBody>
          <form action={uploadMediaAction} className="space-y-4" encType="multipart/form-data">
            <div>
              <Label htmlFor="file">Image file</Label>
              <Input
                id="file"
                name="file"
                type="file"
                accept="image/jpeg,image/png,image/gif,image/webp,image/svg+xml,image/avif"
                required
                className="mt-1"
              />
              <p className="text-xs text-navy/50 mt-1">JPG, PNG, GIF, WebP, SVG, or AVIF. Max 10MB.</p>
            </div>
            <div>
              <Label htmlFor="alt_text">Alt text (optional)</Label>
              <Input id="alt_text" name="alt_text" maxLength={300} className="mt-1" />
            </div>
            <div className="flex justify-end">
              <Button type="submit">Upload</Button>
            </div>
          </form>
          {!blobConfigured ? (
            <p className="text-xs text-amber-700 mt-3 bg-amber-50 border border-amber-200 rounded p-2">
              <code>BLOB_READ_WRITE_TOKEN</code> is not set in this environment. Uploads will fail until
              you add a Vercel Blob read-write token.
            </p>
          ) : null}
        </CardBody>
      </Card>

      <Card>
        <CardHeader><CardTitle>Library ({items.length})</CardTitle></CardHeader>
        <CardBody>
          {items.length === 0 ? (
            <p className="text-sm text-navy/60">No media uploaded yet.</p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {items.map((m) => (
                <div key={m.id} className="border border-navy/10 rounded-lg overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={m.url} alt={m.alt_text ?? m.filename} className="w-full aspect-square object-cover bg-navy/5" />
                  <div className="p-2 text-xs">
                    <div className="font-medium text-navy truncate">{m.filename}</div>
                    <div className="text-navy/50">{fmtSize(m.size_bytes)}</div>
                    <div className="mt-1 flex items-center justify-between gap-2">
                      <a href={m.url} target="_blank" rel="noreferrer" className="text-orange hover:underline">View</a>
                      <form action={deleteMediaAction.bind(null, m.id)}>
                        <button className="text-red-600 hover:underline" type="submit">Delete</button>
                      </form>
                    </div>
                    <input
                      readOnly
                      className="mt-1 w-full text-[10px] font-mono p-1 border border-navy/10 rounded bg-navy/5"
                      defaultValue={m.url}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
