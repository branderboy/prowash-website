import { NextRequest, NextResponse } from "next/server";
import { magicLinkRequestSchema } from "@/lib/validation";
import { createMagicLink, sendMagicLinkEmail } from "@/lib/os/magic-link";
import { getDb } from "@/lib/db";

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const email = String(form.get("email") || "");
  const next = String(form.get("next") || "/os");

  let parsed: { email: string };
  try {
    parsed = magicLinkRequestSchema.parse({ email });
  } catch {
    return NextResponse.redirect(new URL("/os/login?error=Invalid+email", req.url), { status: 303 });
  }

  // Don't reveal whether the email is registered. Always behave as if we sent.
  const sql = getDb();
  const rows = (await sql`SELECT id FROM users WHERE email = ${parsed.email.toLowerCase()} LIMIT 1`) as Array<{ id: number }>;
  if (rows[0]) {
    const { url } = await createMagicLink(parsed.email);
    const linkWithNext = `${url}&next=${encodeURIComponent(next)}`;
    await sendMagicLinkEmail(parsed.email, linkWithNext);
  }

  return NextResponse.redirect(new URL("/os/login?sent=1", req.url), { status: 303 });
}
