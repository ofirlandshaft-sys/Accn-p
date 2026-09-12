// One-time helper: run this locally to get a Google OAuth refresh token for
// the schedule-files feature (see lib/google-drive.ts). You only need to do
// this once — the resulting refresh token is long-lived.
//
// Usage (PowerShell):
//   $env:GOOGLE_OAUTH_CLIENT_ID = "<client id>"
//   $env:GOOGLE_OAUTH_CLIENT_SECRET = "<client secret>"
//   node scripts/get-drive-refresh-token.mjs
//
// Usage (bash):
//   GOOGLE_OAUTH_CLIENT_ID=<client id> GOOGLE_OAUTH_CLIENT_SECRET=<client secret> \
//     node scripts/get-drive-refresh-token.mjs
//
// It prints a URL — open it in your own browser (as the Google account that
// has access to the two roster folders), approve access, and it'll print
// the refresh token back here. Save that into web/.env.local as
// GOOGLE_OAUTH_REFRESH_TOKEN.

import { OAuth2Client } from "google-auth-library";
import http from "node:http";

const PORT = 53682;
const REDIRECT_URI = `http://localhost:${PORT}`;

const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;

if (!clientId || !clientSecret) {
  console.error(
    "Set GOOGLE_OAUTH_CLIENT_ID and GOOGLE_OAUTH_CLIENT_SECRET env vars first (see the usage comment at the top of this file).",
  );
  process.exit(1);
}

const oauth2Client = new OAuth2Client({ clientId, clientSecret, redirectUri: REDIRECT_URI });

const authUrl = oauth2Client.generateAuthUrl({
  access_type: "offline",
  prompt: "consent", // force a refresh_token even if this app was authorized before
  scope: ["https://www.googleapis.com/auth/drive.readonly"],
});

console.log("\nOpen this URL in your browser and approve access:\n");
console.log(authUrl);
console.log("\nWaiting for the redirect to http://localhost:%d ...\n", PORT);

const server = http.createServer((req, res) => {
  void (async () => {
    try {
      const url = new URL(req.url ?? "/", REDIRECT_URI);
      const code = url.searchParams.get("code");
      const error = url.searchParams.get("error");

      if (error) {
        res.writeHead(400, { "Content-Type": "text/html; charset=utf-8" });
        res.end(`<p>Google returned an error: ${error}. You can close this tab.</p>`);
        console.error("Google returned an error:", error);
        server.close();
        process.exit(1);
        return;
      }

      if (!code) {
        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
        res.end("<p>Waiting for the OAuth redirect…</p>");
        return;
      }

      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(
        "<html><body style='font-family:sans-serif'>אפשר לסגור את החלון הזה ולחזור לטרמינל.</body></html>",
      );
      server.close();

      const { tokens } = await oauth2Client.getToken(code);
      if (!tokens.refresh_token) {
        console.error(
          "\nNo refresh_token came back. This usually means this Client ID/account combo was already " +
            "authorized before. Go to https://myaccount.google.com/permissions, remove access for this " +
            "app, and run this script again.\n",
        );
        process.exit(1);
      }

      console.log("\n=== SUCCESS ===");
      console.log("Add this to web/.env.local as GOOGLE_OAUTH_REFRESH_TOKEN:\n");
      console.log(tokens.refresh_token);
      console.log("\n================\n");
      process.exit(0);
    } catch (err) {
      console.error("\nError exchanging the code for tokens:", err);
      try {
        res.writeHead(500).end("Error — check the terminal.");
      } catch {
        // response may already be sent
      }
      server.close();
      process.exit(1);
    }
  })();
});

server.listen(PORT);
