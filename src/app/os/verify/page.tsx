import { redirect } from "next/navigation";
import { consumeMagicLink } from "@/lib/os/magic-link";
import { setSessionCookie, resolveSession } from "@/lib/os/session";
import { getDb } from "@/lib/db";

type SearchParams = { token?: string; next?: string };

export default async function VerifyPage({ searchParams }: { searchParams: SearchParams }) {
  const token = searchParams.token;
  const next = searchParams.next || "/os";

  if (!token) {
    redirect("/os/login?error=Missing+token");
  }

  const consumed = await consumeMagicLink(token);
  if (!consumed) {
    redirect("/os/login?error=Link+expired+or+invalid");
  }

  const sql = getDb();
  // Find user + their first membership. (A user with multiple clients gets the
  // most recently created one for now — client switcher comes later.)
  const rows = (await sql`
    SELECT u.id AS user_id, u.email, m.client_id, m.role
    FROM users u
    LEFT JOIN memberships m ON m.user_id = u.id
    WHERE u.email = ${consumed.email.toLowerCase()}
    ORDER BY m.created_at DESC NULLS LAST
    LIMIT 1
  `) as Array<{ user_id: number; email: string; client_id: number | null; role: "owner" | "manager" | "staff" | null }>;

  const row = rows[0];
  if (!row || !row.client_id || !row.role) {
    redirect("/os/login?error=No+client+access+for+this+email");
  }

  const session = await resolveSession(row.user_id, row.client_id);
  if (!session) {
    redirect("/os/login?error=Could+not+resolve+session");
  }
  await setSessionCookie(session);
  redirect(next);
}
