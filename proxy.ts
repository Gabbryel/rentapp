import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_PREFIXES = ["/_next", "/favicon.ico", "/manifest.webmanifest", "/public/"];
const PUBLIC_EXACT = new Set([
  "/login",
  "/register",
  "/verify",
  "/forgot-password",
  "/reset-password",
  "/unauthorized",
  "/api/me",
  "/api/logout",
  "/api/diagnostics/log",
]);

const SERVER_ACTION_HEADER_KEYS = [
  "next-action",
  "next-action-client-reference-id",
  "next-router-state-tree",
  "next-router-prefetch",
];

function isPublicPath(pathname: string) {
  if (PUBLIC_EXACT.has(pathname)) return true;
  return PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

function isServerActionRequest(req: NextRequest): boolean {
  if (req.method !== "POST") return false;
  const headers = req.headers;
  for (const key of SERVER_ACTION_HEADER_KEYS) {
    if (headers.has(key)) return true;
  }
  const searchParams = req.nextUrl.searchParams;
  if (searchParams.has("__nextAction") || searchParams.has("__NEXT_ACTION")) {
    return true;
  }
  return false;
}

async function logProxyEvent(req: NextRequest, step: string, context: Record<string, unknown> = {}) {
  try {
    await fetch(`${req.nextUrl.origin}/api/diagnostics/log`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        tag: "proxy.issueDue",
        step,
        context: {
          pathname: req.nextUrl.pathname,
          method: req.method,
          referer: req.headers.get("referer"),
          hasCookie: Boolean(req.headers.get("cookie")),
          ...context,
        },
      }),
      cache: "no-store",
    });
  } catch (error) {
    console.error("proxy logger failed", error);
  }
}

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (isPublicPath(pathname)) return NextResponse.next();

  const serverActionRequest = isServerActionRequest(req);
  if (serverActionRequest) {
    await logProxyEvent(req, "hit");
  }

  try {
    const base = req.nextUrl.origin;
    const res = await fetch(`${base}/api/me`, {
      headers: { cookie: req.headers.get("cookie") || "" },
      cache: "no-store",
    });

    if (!res.ok) throw new Error(`status ${res.status}`);

    const me = (await res.json()) as { email: string | null; isAdmin: boolean };

    if (serverActionRequest) {
      await logProxyEvent(req, "me-response", {
        status: res.status,
        hasEmail: Boolean(me.email),
        isAdmin: me.isAdmin,
      });
    }

    if (!me.email) {
      const url = req.nextUrl.clone();
      url.pathname = "/login";
      url.searchParams.set("next", pathname);
      if (serverActionRequest) {
        await logProxyEvent(req, "redirect-login");
      }
      return NextResponse.redirect(url);
    }

    if (!me.isAdmin) {
      const url = req.nextUrl.clone();
      url.pathname = "/unauthorized";
      if (serverActionRequest) {
        await logProxyEvent(req, "rewrite-unauthorized");
      }
      return NextResponse.rewrite(url);
    }

    if (serverActionRequest) {
      await logProxyEvent(req, "allow");
    }
    return NextResponse.next();
  } catch (err) {
    if (serverActionRequest) {
      await logProxyEvent(req, "error", {
        message: err instanceof Error ? err.message : String(err),
      });
    }
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }
}

export const config = {
  matcher: ["/(.*)"],
};
