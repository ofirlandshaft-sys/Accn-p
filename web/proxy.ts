import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifySessionToken, SESSION_COOKIE_NAME } from "@/lib/session";

// Gate the whole app behind Google sign-in (see app/login, lib/auth-login.ts).
// Only the login page and the auth API routes themselves are reachable
// without a valid session — everything else (pages AND API routes, since
// /api/schedule-* exposes real roster data) redirects to /login.
export function proxy(request: NextRequest) {
  const session = verifySessionToken(request.cookies.get(SESSION_COOKIE_NAME)?.value);
  if (session) {
    return NextResponse.next();
  }

  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("next", request.nextUrl.pathname + request.nextUrl.search);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: [
    "/((?!login|api/auth|_next/static|_next/image|favicon\\.ico|icon|apple-icon\\.png|manifest\\.webmanifest|sw\\.js|images/).*)",
  ],
};
