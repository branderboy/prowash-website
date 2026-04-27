import { NextRequest, NextResponse } from "next/server";

const OS_COOKIE = "os_auth";

const PUBLIC_OS_PATHS = new Set(["/os/login", "/os/verify"]);

function isInternalHost(host: string): boolean {
  if (!host) return true;
  const h = host.split(":")[0];
  if (h === "localhost" || h === "127.0.0.1") return true;
  if (h.endsWith(".vercel.app")) return true;
  if (h.endsWith(".vercel.run")) return true;
  return false;
}

export function middleware(req: NextRequest) {
  const url = req.nextUrl;
  const host = req.headers.get("host") || "";
  const pathname = url.pathname;

  // /os/* gating: require os_auth cookie except for login/verify
  if (pathname.startsWith("/os")) {
    if (PUBLIC_OS_PATHS.has(pathname) || pathname.startsWith("/os/verify")) {
      return NextResponse.next();
    }
    const cookie = req.cookies.get(OS_COOKIE)?.value;
    if (!cookie) {
      const loginUrl = url.clone();
      loginUrl.pathname = "/os/login";
      loginUrl.searchParams.set("next", pathname);
      return NextResponse.redirect(loginUrl);
    }
    return NextResponse.next();
  }

  // Skip API + Next internals + assets for the custom-domain rewrite
  if (
    pathname.startsWith("/api") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/site") ||
    pathname === "/favicon.ico" ||
    pathname.startsWith("/images") ||
    pathname.startsWith("/css") ||
    pathname.startsWith("/fonts") ||
    pathname.match(/\.[a-z0-9]+$/i)
  ) {
    return NextResponse.next();
  }

  // Custom-domain rewrite: any non-internal host is treated as a tenant domain
  // and rewritten to /site/[path]. The /site handler resolves which tenant
  // owns the host via the domains table.
  if (!isInternalHost(host)) {
    const rewritten = url.clone();
    rewritten.pathname = `/site${pathname === "/" ? "" : pathname}`;
    return NextResponse.rewrite(rewritten);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
