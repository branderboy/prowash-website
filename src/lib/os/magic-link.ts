import crypto from "node:crypto";
import { getDb } from "@/lib/db";
import { sendEmail } from "@/lib/email";

const TTL_MINUTES = 15;

function hashToken(t: string) {
  return crypto.createHash("sha256").update(t).digest("hex");
}

export async function createMagicLink(email: string): Promise<{ token: string; url: string }> {
  const sql = getDb();
  const token = crypto.randomBytes(32).toString("hex");
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + TTL_MINUTES * 60 * 1000);
  await sql`
    INSERT INTO magic_links (email, token_hash, expires_at)
    VALUES (${email.toLowerCase()}, ${tokenHash}, ${expiresAt.toISOString()})
  `;
  const base = process.env.APP_BASE_URL || "http://localhost:3000";
  const url = `${base}/os/verify?token=${token}`;
  return { token, url };
}

export async function consumeMagicLink(token: string): Promise<{ email: string } | null> {
  const sql = getDb();
  const tokenHash = hashToken(token);
  const rows = (await sql`
    SELECT id, email, expires_at, used_at FROM magic_links
    WHERE token_hash = ${tokenHash}
    LIMIT 1
  `) as Array<{ id: number; email: string; expires_at: string; used_at: string | null }>;
  const row = rows[0];
  if (!row) return null;
  if (row.used_at) return null;
  if (new Date(row.expires_at).getTime() < Date.now()) return null;
  await sql`UPDATE magic_links SET used_at = NOW() WHERE id = ${row.id}`;
  return { email: row.email };
}

export async function sendMagicLinkEmail(email: string, url: string) {
  const subject = "Your Tagglefish OS sign-in link";
  const html = `
    <div style="font-family:ui-sans-serif,system-ui,sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#0b1f3a">
      <h2 style="color:#0b1f3a;margin:0 0 12px">Sign in to Tagglefish OS</h2>
      <p>Click the button below to sign in. This link expires in ${TTL_MINUTES} minutes and can only be used once.</p>
      <p style="margin:24px 0">
        <a href="${url}" style="background:#ff6a13;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:600">Sign in</a>
      </p>
      <p style="color:#64748b;font-size:13px">If the button doesn't work, paste this URL into your browser:<br><span style="word-break:break-all">${url}</span></p>
      <p style="color:#64748b;font-size:13px;margin-top:24px">If you didn't request this, you can safely ignore the email.</p>
    </div>
  `;
  const text = `Sign in to Tagglefish OS: ${url}\n\nThis link expires in ${TTL_MINUTES} minutes.`;
  return sendEmail({ to: email, subject, html, text });
}
