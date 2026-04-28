import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { loginSchema } from "@/lib/validation";
import { verifyPassword } from "@/lib/os/password";
import { encodeSession, OS_COOKIE, type OsSession } from "@/lib/os/session";

function safeNextPath(raw: string): string {
  if (!raw.startsWith("/")) return "/os";
  // Reject protocol-relative ("//host") and backslash variants ("/\host")
  if (raw.startsWith("//") || raw.startsWith("/\\")) return "/os";
  return raw;
}

function loginErrorRedirect(req: NextRequest, error: string, next: string): NextResponse {
  const url = new URL("/os/login", req.url);
  url.searchParams.set("error", error);
  if (next && next !== "/os") url.searchParams.set("next", next);
  return NextResponse.redirect(url, { status: 303 });
}

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const rawNext = String(form.get("next") || "/os") || "/os";
  const next = safeNextPath(rawNext);
  let parsed: { email: string; password: string };
  try {
    parsed = loginSchema.parse({
      email: String(form.get("email") || ""),
      password: String(form.get("password") || ""),
    });
  } catch {
    return loginErrorRedirect(req, "Invalid input", next);
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
  if (!row || !(await verifyPassword(parsed.password, row.password_hash))) {
    return loginErrorRedirect(req, "Invalid email or password", next);
  }

  const expiresAt = Date.now() + 30 * 24 * 60 * 60 * 1000;
  const cookie = encodeSession({
    userId: row.user_id,
    clientId: row.client_id,
    role: row.role,
    email: row.email,
    expiresAt,
  });

  const res = NextResponse.redirect(new URL(next, req.url), { status: 303 });
  res.cookies.set(OS_COOKIE, cookie, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: new Date(expiresAt),
  });
  return res;
}
