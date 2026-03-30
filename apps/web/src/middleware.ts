/**
 * Lightweight middleware — only blocks unauthenticated access to protected routes.
 * Does NOT redirect logged-in users away from /login (that caused redirect loops
 * with stale/expired Supabase cookies). The login page handles post-auth redirect.
 */
import { NextResponse, type NextRequest } from "next/server";

const PROTECTED_PATHS = ["/dashboard", "/tests", "/analytics", "/leaderboard", "/profile", "/tutor", "/admin"];

// Supabase session cookies contain "-auth-token" in the name and a non-empty value
function hasSessionCookie(request: NextRequest): boolean {
  return request.cookies.getAll().some(
    (c) => c.name.includes("-auth-token") && c.value.length > 10
  );
}

export function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;

  const isProtected = PROTECTED_PATHS.some((p) => path.startsWith(p));
  if (isProtected && !hasSessionCookie(request)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("redirectTo", path);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|api/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
