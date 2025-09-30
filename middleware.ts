import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Public paths that remain accessible without auth
const PUBLIC_PREFIXES = ["/_next", "/favicon.ico", "/manifest.webmanifest", "/public/"];
const PUBLIC_EXACT = new Set(["/login", "/register", "/unauthorized", "/api/me", "/api/logout"]);

function isPublicPath(pathname: string) {
  if (PUBLIC_EXACT.has(pathname)) return true;
  return PUBLIC_PREFIXES.some((p) => pathname.startsWith(p));
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (isPublicPath(pathname)) return NextResponse.next();
  try {
    const base = req.nextUrl.origin;
    const res = await fetch(`${base}/api/me`, {
      headers: { cookie: req.headers.get("cookie") || "" },
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`status ${res.status}`);
    const me = (await res.json()) as { email: string | null; isAdmin: boolean };
    if (!me.email) {
      const url = req.nextUrl.clone();
      url.pathname = "/login";
      url.searchParams.set("next", pathname);
      return NextResponse.redirect(url);
    }
    if (!me.isAdmin) {
      const url = req.nextUrl.clone();
      url.pathname = "/unauthorized";
      return NextResponse.rewrite(url);
    }
    return NextResponse.next();
  } catch {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }
}

export const config = {
  matcher: ["/(.*)"],
};
