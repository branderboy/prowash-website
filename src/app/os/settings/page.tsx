import { requireOsSession } from "@/lib/os/session";
import { withClient } from "@/lib/os/tenancy";
import { getDb } from "@/lib/db";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { saveSettingsAction } from "./actions";

async function load() {
  return withClient(async ({ clientId }) => {
    const sql = getDb();
    const [client, settings] = await Promise.all([
      sql`SELECT name, primary_host FROM clients WHERE id = ${clientId}` as unknown as Promise<Array<{ name: string; primary_host: string | null }>>,
      sql`SELECT favicon_url, default_og_image_url, primary_phone FROM site_settings WHERE client_id = ${clientId}` as unknown as Promise<Array<{ favicon_url: string | null; default_og_image_url: string | null; primary_phone: string | null }>>,
    ]);
    return { client: client[0], settings: settings[0] ?? { favicon_url: null, default_og_image_url: null, primary_phone: null } };
  });
}

export default async function SettingsPage() {
  requireOsSession();
  const data = await load();
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-navy">Site settings</h1>
        <p className="text-sm text-navy/60 mt-1">Site-wide defaults: favicon, social share image, primary phone.</p>
      </div>
      <Card>
        <CardHeader><CardTitle>{data.client?.name ?? "Site"} ({data.client?.primary_host ?? ""})</CardTitle></CardHeader>
        <CardBody>
          <form action={saveSettingsAction} className="space-y-4">
            <div>
              <Label htmlFor="favicon_url">Favicon URL</Label>
              <Input id="favicon_url" name="favicon_url" defaultValue={data.settings.favicon_url ?? ""} className="mt-1" />
            </div>
            <div>
              <Label htmlFor="default_og_image_url">Default social share image URL</Label>
              <Input id="default_og_image_url" name="default_og_image_url" defaultValue={data.settings.default_og_image_url ?? ""} className="mt-1" />
            </div>
            <div>
              <Label htmlFor="primary_phone">Primary phone</Label>
              <Input id="primary_phone" name="primary_phone" defaultValue={data.settings.primary_phone ?? ""} className="mt-1" />
            </div>
            <div className="flex justify-end">
              <Button type="submit" size="lg">Save settings</Button>
            </div>
          </form>
        </CardBody>
      </Card>
    </div>
  );
}
