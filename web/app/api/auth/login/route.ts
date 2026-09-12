import crypto from "node:crypto";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getLoginOAuthClient } from "@/lib/auth-login";

export const dynamic = "force-dynamic";

const isProd = process.env.NODE_ENV === "production";

export async function GET(request: NextRequest) {
  const nextPath = request.nextUrl.searchParams.get("next") ?? "/";
  const redirectUri = new URL("/api/auth/callback", request.nextUrl.origin).toString();
  const client = getLoginOAuthClient(redirectUri);

  const state = crypto.randomBytes(16).toString("hex");
  const authUrl = client.generateAuthUrl({
    access_type: "online", // just signing in — no offline refresh token needed
    scope: ["openid", "email", "profile"],
    state,
    prompt: "select_account",
  });

  const res = NextResponse.redirect(authUrl);
  const cookieOpts = {
    httpOnly: true,
    secure: isProd,
    sameSite: "lax" as const,
    maxAge: 600,
    path: "/",
  };
  res.cookies.set("oauth_state", state, cookieOpts);
  res.cookies.set("oauth_next", nextPath, cookieOpts);
  return res;
}
