import { NextResponse, type NextRequest } from "next/server";

const SESSION_COOKIES = ["authjs.session-token", "__Secure-authjs.session-token"];

/**
 * Lightweight edge gate: unauthenticated visitors are sent to /login.
 * Role enforcement (child vs parent) happens server-side in pages and every API route.
 */
export function middleware(req: NextRequest) {
  if (process.env.DEV_BYPASS_AUTH === "true") return NextResponse.next();
  const hasSession = SESSION_COOKIES.some((c) => req.cookies.has(c));
  if (hasSession) return NextResponse.next();
  if (req.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.search = "";
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/chat/:path*", "/admin/:path*", "/api/chat/:path*", "/api/admin/:path*", "/api/me"],
};
