import { getDb } from "@/lib/db";
import type { OsSession } from "./session";

export async function audit(
  session: Pick<OsSession, "clientId" | "userId">,
  action: string,
  resource: string,
  resourceId?: string | number | null,
  meta?: Record<string, unknown>
) {
  const sql = getDb();
  await sql`
    INSERT INTO audit_log (client_id, user_id, action, resource, resource_id, meta)
    VALUES (${session.clientId}, ${session.userId}, ${action}, ${resource}, ${resourceId == null ? null : String(resourceId)}, ${meta ? JSON.stringify(meta) : null})
  `;
}
