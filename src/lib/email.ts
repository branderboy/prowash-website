import { Resend } from "resend";
import { getDb } from "./db";

const FROM = process.env.MAGIC_LINK_FROM || "Tagglefish <noreply@tagglefish.com>";

let _resend: Resend | null = null;
function client(): Resend | null {
  if (_resend) return _resend;
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  _resend = new Resend(key);
  return _resend;
}

export type SendEmailArgs = {
  to: string;
  subject: string;
  html: string;
  text?: string;
  clientId?: number | null;
};

export async function sendEmail({ to, subject, html, text, clientId = null }: SendEmailArgs) {
  const sql = getDb();
  const c = client();

  if (!c) {
    console.log(`[email:dev] to=${to} subject=${subject}\n${text || html}`);
    await sql`
      INSERT INTO email_log (client_id, to_email, subject, status, provider_id, error)
      VALUES (${clientId}, ${to}, ${subject}, 'dev-console', NULL, NULL)
    `;
    return { ok: true, devConsole: true } as const;
  }

  try {
    const res = await c.emails.send({ from: FROM, to, subject, html, text });
    await sql`
      INSERT INTO email_log (client_id, to_email, subject, status, provider_id, error)
      VALUES (${clientId}, ${to}, ${subject}, 'sent', ${res.data?.id ?? null}, ${res.error?.message ?? null})
    `;
    if (res.error) return { ok: false, error: res.error.message } as const;
    return { ok: true, providerId: res.data?.id } as const;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    await sql`
      INSERT INTO email_log (client_id, to_email, subject, status, provider_id, error)
      VALUES (${clientId}, ${to}, ${subject}, 'error', NULL, ${msg})
    `;
    return { ok: false, error: msg } as const;
  }
}
