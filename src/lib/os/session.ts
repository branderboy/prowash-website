import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import crypto from "node:crypto";
import { getDb } from "@/lib/db";

export const OS_COOKIE = "os_auth";
const SECRET = () => process.env.OS_AUTH_SECRET || "dev-only-insecure-secret-change-me";
const SESSION_DAYS = 30;

export type OsSession = {
  userId: number;
  clientId: number;
  role: "owner" | "manager" | "staff";
  email: string;
  expiresAt: number;
};

function sign(payload: string): string {
  return crypto.createHmac("sha256", SECRET()).update(payload).digest("hex");
}

export function encodeSession(s: Omit<OsSession, "expiresAt"> & { expiresAt?: number }): string {
  const exp = s.expiresAt ?? Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000;
  const payload = `${s.userId}:${s.clientId}:${s.role}:${encodeURIComponent(s.email)}:${exp}`;
  return `${payload}.${sign(payload)}`;
}

export function decodeSession(raw: string | undefined | null): OsSession | null {
  if (!raw) return null;
  const dot = raw.lastIndexOf(".");
  if (dot < 0) return null;
  const payload = raw.slice(0, dot);
  const sig = raw.slice(dot + 1);
  const expected = sign(payload);
  if (!crypto.timingSafeEqual(Buffer.from(sig, "hex"), Buffer.from(expected, "hex"))) return null;
  const [uid, cid, role, email, exp] = payload.split(":");
  const expiresAt = Number(exp);
  if (!uid || !cid || !email || !expiresAt) return null;
  if (Date.now() > expiresAt) return null;
  if (!["owner", "manager", "staff"].includes(role)) return null;
  return {
    userId: Number(uid),
    clientId: Number(cid),
    role: role as OsSession["role"],
    email: decodeURIComponent(email),
    expiresAt,
  };
}

export function getOsSession(): OsSession | null {
  const c = cookies().get(OS_COOKIE)?.value;
  return decodeSession(c);
}

export function requireOsSession(): OsSession {
  const s = getOsSession();
  if (!s) redirect("/os/login");
  return s;
}

export function requireRole(min: "owner" | "manager" | "staff"): OsSession {
  const s = requireOsSession();
  const order = { staff: 0, manager: 1, owner: 2 } as const;
  if (order[s.role] < order[min]) {
    throw new Error(`forbidden: requires ${min}`);
  }
  return s;
}

export async function setSessionCookie(s: OsSession) {
  cookies().set(OS_COOKIE, encodeSession(s), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: new Date(s.expiresAt),
  });
}

export async function clearSessionCookie() {
  cookies().delete(OS_COOKIE);
}

/**
 * Resolve a session from the database to ensure the user still has the membership
 * we encoded. Use this on the first request after verify; for normal page loads
 * the cookie alone is fine.
 */
export async function resolveSession(userId: number, clientId: number): Promise<OsSession | null> {
  const sql = getDb();
  const rows = (await sql`
    SELECT u.id AS user_id, u.email, m.client_id, m.role
    FROM users u
    JOIN memberships m ON m.user_id = u.id
    WHERE u.id = ${userId} AND m.client_id = ${clientId}
    LIMIT 1
  `) as Array<{ user_id: number; email: string; client_id: number; role: OsSession["role"] }>;
  const row = rows[0];
  if (!row) return null;
  return {
    userId: row.user_id,
    email: row.email,
    clientId: row.client_id,
    role: row.role,
    expiresAt: Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000,
  };
}
