import { NextRequest, NextResponse } from "next/server";
import { OS_COOKIE } from "@/lib/os/session";

export async function POST(req: NextRequest) {
  // Reject cross-origin POSTs so a malicious page can't sign the user out.
  // sameSite=lax cookies cover most browsers, but belt-and-suspenders here.
  const origin = req.headers.get("origin");
  const expected = new URL(req.url).origin;
  if (origin && origin !== expected) {
    return NextResponse.json({ ok: false }, { status: 403 });
  }
  const res = NextResponse.redirect(new URL("/os/login", req.url), { status: 303 });
  res.cookies.delete(OS_COOKIE);
  return res;
}
