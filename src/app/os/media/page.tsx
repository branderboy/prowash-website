import { requireOsSession } from "@/lib/os/session";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";

export default function MediaPage() {
  requireOsSession();
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-navy">Media library</h1>
        <p className="text-sm text-navy/60 mt-1">
          Upload images and reference them from page bodies and post covers. Vercel Blob upload integration is wired
          via <code>/api/os/upload</code>.
        </p>
      </div>
      <Card>
        <CardHeader><CardTitle>Coming soon</CardTitle></CardHeader>
        <CardBody>
          <p className="text-sm text-navy/70">
            The media table is in the schema. The upload route + grid UI ship in the next milestone.
          </p>
        </CardBody>
      </Card>
    </div>
  );
}
