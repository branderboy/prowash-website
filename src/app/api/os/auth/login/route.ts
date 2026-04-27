import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { loginSchema } from "@/lib/validation";
import { verifyPassword } from "@/lib/os/password";
import { encodeSession, OS_COOKIE, type OsSession } from "@/lib/os/session";

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const next = String(form.get("next") || "/os") || "/os";
  let parsed: { email: string; password: string };
  try {
    parsed = loginSchema.parse({
      email: String(form.get("email") || ""),
      password: String(form.get("password") || ""),
    });
  } catch {
    return NextResponse.redirect(new URL("/os/login?error=Invalid+input", req.url), { status: 303 });
  }

  const sql = getDb();
  const rows = (await sql`
    SELECT u.id AS user_id, u.email, u.password_hash, m.client_id, m.role
    FROM users u
    JOIN memberships m ON m.user_id = u.id
    WHERE u.email = ${parsed.email.toLowerCase()}
    ORDER BY m.created_at DESC
    LIMIT 1
  `) as Array<{ user_id: number; email: string; password_hash: string | null; client_id: number; role: OsSession["role"] }>;

  const row = rows[0];
  if (!row || !verifyPassword(parsed.password, row.password_hash)) {
    return NextResponse.redirect(new URL("/os/login?error=Invalid+email+or+password", req.url), { status: 303 });
  }

  const expiresAt = Date.now() + 30 * 24 * 60 * 60 * 1000;
  const cookie = encodeSession({
    userId: row.user_id,
    clientId: row.client_id,
    role: row.role,
    email: row.email,
    expiresAt,
  });

  const safeNext = next.startsWith("/") ? next : "/os";
  const res = NextResponse.redirect(new URL(safeNext, req.url), { status: 303 });
  res.cookies.set(OS_COOKIE, cookie, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: new Date(expiresAt),
  });
  return res;
}
