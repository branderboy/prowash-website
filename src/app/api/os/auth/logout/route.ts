import { NextRequest, NextResponse } from "next/server";
import { OS_COOKIE } from "@/lib/os/session";

export async function POST(req: NextRequest) {
  const res = NextResponse.redirect(new URL("/os/login", req.url), { status: 303 });
  res.cookies.delete(OS_COOKIE);
  return res;
}
