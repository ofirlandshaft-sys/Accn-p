import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getLoginOAuthClient, isEmailAllowed } from "@/lib/auth-login";
import { createSessionToken, SESSION_COOKIE_NAME } from "@/lib/session";

export const dynamic = "force-dynamic";

const isProd = process.env.NODE_ENV === "production";

export async function GET(request: NextRequest) {
  const origin = request.nextUrl.origin;
  const code = request.nextUrl.searchParams.get("code");
  const returnedState = request.nextUrl.searchParams.get("state");
  const expectedState = request.cookies.get("oauth_state")?.value;
  const nextPath = request.cookies.get("oauth_next")?.value ?? "/";

  function clearOauthCookies(res: NextResponse) {
    res.cookies.delete("oauth_state");
    res.cookies.delete("oauth_next");
    return res;
  }

  if (!code || !returnedState || !expectedState || returnedState !== expectedState) {
    return clearOauthCookies(NextResponse.redirect(new URL("/login?error=state", origin)));
  }

  try {
    const redirectUri = new URL("/api/auth/callback", origin).toString();
    const client = getLoginOAuthClient(redirectUri);
    const { tokens } = await client.getToken(code);

    if (!tokens.id_token) {
      throw new Error("Google did not return an id_token.");
    }

    const ticket = await client.verifyIdToken({
      idToken: tokens.id_token,
      audience: process.env.GOOGLE_LOGIN_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    const email = payload?.email;

    if (!email || !payload?.email_verified) {
      return clearOauthCookies(NextResponse.redirect(new URL("/login?error=no_email", origin)));
    }

    if (!isEmailAllowed(email)) {
      const url = new URL("/login", origin);
      url.searchParams.set("error", "not_allowed");
      url.searchParams.set("email", email);
      return clearOauthCookies(NextResponse.redirect(url));
    }

    const res = NextResponse.redirect(new URL(nextPath, origin));
    res.cookies.set(SESSION_COOKIE_NAME, createSessionToken(email), {
      httpOnly: true,
      secure: isProd,
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 30,
      path: "/",
    });
    return clearOauthCookies(res);
  } catch (err) {
    console.error("Google login callback failed:", err);
    return clearOauthCookies(NextResponse.redirect(new URL("/login?error=failed", origin)));
  }
}
