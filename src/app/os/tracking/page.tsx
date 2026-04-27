import { requireOsSession } from "@/lib/os/session";
import { withClient } from "@/lib/os/tenancy";
import { getDb } from "@/lib/db";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { saveTrackingAction } from "./actions";

async function load() {
  return withClient(async ({ clientId }) => {
    const sql = getDb();
    const rows = (await sql`
      SELECT ga4_id, gtm_id, google_verification, bing_verification FROM site_settings WHERE client_id = ${clientId}
    `) as Array<{ ga4_id: string | null; gtm_id: string | null; google_verification: string | null; bing_verification: string | null }>;
    return rows[0] ?? { ga4_id: null, gtm_id: null, google_verification: null, bing_verification: null };
  });
}

export default async function TrackingPage() {
  requireOsSession();
  const data = await load();
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-navy">Tracking</h1>
        <p className="text-sm text-navy/60 mt-1">Google Analytics, Google Tag Manager, and search console verification codes.</p>
      </div>
      <Card>
        <CardHeader><CardTitle>Codes</CardTitle></CardHeader>
        <CardBody>
          <form action={saveTrackingAction} className="space-y-4">
            <div>
              <Label htmlFor="ga4_id">Google Analytics 4 ID</Label>
              <Input id="ga4_id" name="ga4_id" defaultValue={data.ga4_id ?? ""} placeholder="G-XXXXXXXXXX" className="mt-1" />
            </div>
            <div>
              <Label htmlFor="gtm_id">Google Tag Manager ID</Label>
              <Input id="gtm_id" name="gtm_id" defaultValue={data.gtm_id ?? ""} placeholder="GTM-XXXXXXX" className="mt-1" />
            </div>
            <div>
              <Label htmlFor="google_verification">Google Search Console verification</Label>
              <Input id="google_verification" name="google_verification" defaultValue={data.google_verification ?? ""} className="mt-1" />
            </div>
            <div>
              <Label htmlFor="bing_verification">Bing Webmaster verification</Label>
              <Input id="bing_verification" name="bing_verification" defaultValue={data.bing_verification ?? ""} className="mt-1" />
            </div>
            <div className="flex justify-end">
              <Button type="submit" size="lg">Save tracking</Button>
            </div>
          </form>
        </CardBody>
      </Card>
    </div>
  );
}
