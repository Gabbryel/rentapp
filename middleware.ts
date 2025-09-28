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
  // Temporarily disable all restrictions; allow every route.
  return NextResponse.next();
}

export const config = {
  matcher: "/:path*",
};
