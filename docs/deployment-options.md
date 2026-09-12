# Deployment Options (as discussed with Ofir, no final decision made)

Ofir asked, roughly: "can this be a real-time web app, how long would a
refresh take, and does GitHub alone work or do I need Vercel?" Here's what
was covered.

## Latency estimate for a live rebuild

Not benchmarked, but reasoned through:
- Fetching the Sheet's current data (Sheets/Drive API): **~0.5–2 seconds**,
  network-dominated.
- Recomputing the matrix (51 people × 30 days): **microseconds** — trivial
  even at 10× this scale.
- Rendering: instant.

**Net estimate: ~1–3 seconds per refresh.** The bottleneck is the network
round-trip to Google, not the computation. This holds whether the refresh
happens on page load, on a timer, or on-demand via a button.

Two different meanings of "real-time" were distinguished:
1. **Refresh-on-demand / on-load**: page fetches current data when opened
   or when a refresh button is clicked. Matches the ~1–3s estimate above.
   Simple, no extra infrastructure.
2. **Continuous live updates**: either polling on an interval (e.g. every
   30–60 seconds) or true push-based updates via Google's change-
   notification/webhook API on the Sheet (updates within ~1–2s of an actual
   edit, no polling delay). This needs a small backend to hold credentials
   and (for the push option) a public webhook endpoint. Judged likely
   overkill for a monthly roster that doesn't change every few seconds —
   but Ofir didn't rule it out, just wasn't pushed toward it.

## Option 1 — GitHub Pages alone: ruled out

GitHub Pages serves **static files only** — there's no server-side runtime.
Two hard blockers for this project:
- No secure place to hold a Google API credential (anything in the
  client-side JS is visible to anyone who opens dev tools).
- No server-side code to actually make the authenticated fetch to Google's
  API.

Conclusion given to Ofir: **not sufficient by itself.**

## Option 2 — Vercel: recommended default if a "standard web app" is wanted

- Serverless functions (API routes) can hold the Google credential as an
  environment variable and do the fetch + compute server-side, returning
  JSON (or a rendered page) to the browser.
- Supports **Cron Jobs** (scheduled function invocations) if "continuous
  live updates" (option 2 above) is wanted without building a webhook
  receiver.
- Deploys from a connected **GitHub repo** — so the choice isn't really
  "GitHub or Vercel," it's "GitHub (source) + Vercel (hosting/runtime)."
- **This Claude environment had a Vercel MCP connector available**
  mid-conversation (tools such as `mcp__Vercel__deploy_to_vercel`,
  `create_git_project`, `list_projects`, `get_runtime_logs`, etc.). If
  Claude Code has the same connector, deployment and even log-checking
  could potentially happen directly from an agent session — check what's
  available before assuming a manual `vercel` CLI flow is required.

## Option 3 — Google Apps Script: flagged as possibly the best fit

Specifically because the data source is *already* a Google Sheet:
- Apps Script runs inside Google's infrastructure and reads the Sheet
  directly via `SpreadsheetApp.openById(...)` — **no OAuth setup, no
  service-account credential to manage, no separate hosting.**
- Can serve a small web app via a `doGet(e)` function returning HTML.
- **Access control is a deployment setting** ("Execute as: me" / "Who has
  access: specific people") — this directly satisfies the privacy
  constraint (real employee names, must not be publicly reachable) with no
  extra auth code.
- Tradeoff: it's a more constrained runtime than a normal Node/Vercel app
  (execution time limits, a more unusual dev workflow, less flexible
  tooling), and it's less "portable" if this ever needs to move off Google.

## What was NOT decided

Ofir did not pick one of these — this write-up exists so the decision can
be made deliberately when picking the project back up, not defaulted to
without discussion. Given:
- the data is 100% Google Sheets,
- the privacy constraint is real and already caused one rejected approach
  (a public Claude Artifact link), and
- Apps Script solves both the credential problem *and* the access-control
  problem for free,

**Apps Script deserves serious consideration** even though Vercel is the
more conventional choice for "a web app." Raise this explicitly with Ofir
rather than defaulting to the more familiar stack.
