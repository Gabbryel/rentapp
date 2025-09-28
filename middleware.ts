import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

// Public paths that should remain accessible without a session cookie
const PUBLIC_PATHS = new Set([
  "/login",
  "/register",
  "/unauthorized",
  "/about",
  "/favicon.ico",
]);

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Always allow API and static assets
  if (pathname.startsWith("/api/")) return NextResponse.next();
  if (pathname.startsWith("/_next/")) return NextResponse.next();
  if (pathname.startsWith("/public/")) return NextResponse.next();
  if (/[.](?:svg|png|jpg|jpeg|gif|webp|pdf|ico)$/i.test(pathname)) return NextResponse.next();

  if (PUBLIC_PATHS.has(pathname)) return NextResponse.next();

  const session = req.cookies.get("session")?.value;
  if (!session) {
    const url = req.nextUrl.clone();
    url.pathname = "/unauthorized";
    url.search = "";
    return NextResponse.rewrite(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: "/:path*",
};
