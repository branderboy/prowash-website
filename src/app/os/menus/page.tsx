import { requireOsSession } from "@/lib/os/session";
import { withClient } from "@/lib/os/tenancy";
import { getDb } from "@/lib/db";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { saveMenuAction } from "./actions";

async function loadMenus() {
  return withClient(async ({ clientId }) => {
    const sql = getDb();
    const rows = (await sql`
      SELECT location, items FROM menus WHERE client_id = ${clientId}
    `) as Array<{ location: string; items: unknown }>;
    const map: Record<string, string> = { header: "[]", footer: "[]" };
    for (const r of rows) {
      map[r.location] = JSON.stringify(r.items, null, 2);
    }
    return map;
  });
}

export default async function MenusPage() {
  requireOsSession();
  const menus = await loadMenus();
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-navy">Menus</h1>
        <p className="text-sm text-navy/60 mt-1">
          Header and footer menu items as JSON. A visual editor is coming; for now edit the JSON directly.
        </p>
      </div>
      {(["header", "footer"] as const).map((loc) => (
        <Card key={loc}>
          <CardHeader><CardTitle>{loc} menu</CardTitle></CardHeader>
          <CardBody>
            <form action={saveMenuAction.bind(null, loc)}>
              <Textarea name="items" rows={14} defaultValue={menus[loc] ?? "[]"} />
              <div className="mt-3 flex justify-end">
                <Button type="submit">Save {loc}</Button>
              </div>
            </form>
          </CardBody>
        </Card>
      ))}
    </div>
  );
}
