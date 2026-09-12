import "server-only";
import { OAuth2Client } from "google-auth-library";

let cachedAuth: OAuth2Client | null = null;

// The org that owns the Drive folders blocks service-account key creation
// (org policy `iam.disableServiceAccountKeyCreation`), so this authenticates
// as Ofir's own Google identity via a one-time OAuth grant instead — see
// scripts/get-drive-refresh-token.mjs and web/.env.local.example.
export function getAuthClient(): OAuth2Client {
  if (cachedAuth) return cachedAuth;

  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_OAUTH_REFRESH_TOKEN;
  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error(
      "Missing GOOGLE_OAUTH_CLIENT_ID / GOOGLE_OAUTH_CLIENT_SECRET / GOOGLE_OAUTH_REFRESH_TOKEN env vars. " +
        "See web/.env.local.example for setup instructions.",
    );
  }

  const client = new OAuth2Client({ clientId, clientSecret });
  client.setCredentials({ refresh_token: refreshToken });
  cachedAuth = client;
  return cachedAuth;
}
