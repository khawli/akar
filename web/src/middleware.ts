import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { sessionCookieName, verifySession } from "@/lib/auth/session";

function isPublicPath(pathname: string) {
  return (
    pathname === "/" ||
    pathname.startsWith("/login") ||
    pathname.startsWith("/signup") ||
    pathname.startsWith("/api/health") ||
    pathname.startsWith("/api/auth")
  );
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Public
  if (isPublicPath(pathname)) return NextResponse.next();

  const token = req.cookies.get(sessionCookieName())?.value;

  // API must return 401 JSON, not redirect
  if (pathname.startsWith("/api/")) {
    if (!token) {
      return NextResponse.json({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });
    }
    try {
      await verifySession(token);
      return NextResponse.next();
    } catch {
      return NextResponse.json({ ok: false, error: "INVALID_SESSION" }, { status: 401 });
    }
  }

  // App pages: redirect to login
  if (pathname.startsWith("/app")) {
    if (!token) return NextResponse.redirect(new URL("/login", req.url));
    try {
      await verifySession(token);
      return NextResponse.next();
    } catch {
      return NextResponse.redirect(new URL("/login", req.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/app/:path*", "/api/:path*"],
};
