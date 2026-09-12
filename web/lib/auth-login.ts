import "server-only";
import { OAuth2Client } from "google-auth-library";

/**
 * A separate OAuth client from lib/google-auth.ts (which is a "Desktop app"
 * client used server-side, offline, for Drive access). This one is a "Web
 * application" client used for the user-facing "Sign in with Google" gate —
 * see scripts/get-drive-refresh-token.mjs vs this file for the distinction.
 */
export function getLoginOAuthClient(redirectUri: string): OAuth2Client {
  const clientId = process.env.GOOGLE_LOGIN_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_LOGIN_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error(
      "Missing GOOGLE_LOGIN_CLIENT_ID / GOOGLE_LOGIN_CLIENT_SECRET env vars. See web/.env.local.example.",
    );
  }
  return new OAuth2Client({ clientId, clientSecret, redirectUri });
}

function getAllowedEmails(): string[] {
  return (process.env.ALLOWED_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export function isEmailAllowed(email: string): boolean {
  return getAllowedEmails().includes(email.trim().toLowerCase());
}
