import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import crypto from "node:crypto";

export const OS_COOKIE = "os_auth";
const SECRET = () => {
  const v = process.env.OS_AUTH_SECRET;
  if (!v || v.length < 32) {
    throw new Error("OS_AUTH_SECRET must be set to a value of at least 32 characters");
  }
  return v;
};
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
  let expected: string;
  try {
    expected = sign(payload);
  } catch {
    return null;
  }
  const sigBuf = Buffer.from(sig, "hex");
  const expBuf = Buffer.from(expected, "hex");
  if (sigBuf.length !== expBuf.length || sigBuf.length === 0) return null;
  if (!crypto.timingSafeEqual(sigBuf, expBuf)) return null;
  const [uid, cid, role, email, exp] = payload.split(":");
  const expiresAt = Number(exp);
  if (!uid || !cid || !email || !expiresAt) return null;
  const userId = Number(uid);
  const clientId = Number(cid);
  if (!Number.isFinite(userId) || !Number.isFinite(clientId)) return null;
  if (Date.now() > expiresAt) return null;
  if (!["owner", "manager", "staff"].includes(role)) return null;
  return {
    userId,
    clientId,
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

