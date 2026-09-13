# Shift Partner Matrix — Project Context

> This file is written for Claude Code. It captures everything decided across
> the planning conversation and the build/deploy sessions here, so a fresh
> session can continue the work without re-deriving it. Read this file plus
> everything in `docs/` before writing code.

## Current status (read this first)

**The web app is live, deployed, and working end-to-end.** This is no longer
just static prototypes — see below for what that means concretely.

- **Live URL**: https://accn-p.vercel.app — a Next.js 16 app (App Router,
  TypeScript, no Tailwind) in `web/`, deployed on **Vercel** (project `accn-p`
  under Ofir's personal Vercel team "OFIR"; **Root Directory is `web`**, not
  repo root — this is a subdirectory deploy).
- **Source control**: GitHub, **`ofirlandshaft-sys/Accn-p`** (private, under
  Ofir's *personal* account — not an Organization; Vercel's free Hobby plan
  can't deploy from a private *Organization* repo, which is why an earlier
  attempt under a GitHub org named `Accn-p` had to be recreated under the
  personal account). Git was initialized at the repo root (it wasn't a git
  repo before this); `main` is the deployed branch.
- **Access control — resolved**: the whole app sits behind a **Google
  sign-in gate** (see `proxy.ts`), restricted to an email allowlist. This
  satisfies the non-negotiable privacy constraint (real employee names) —
  see that section below, now marked resolved rather than open.
- **Live data — resolved**: the app reads the roster **live from Google
  Drive** (file list) **and live from the Google Sheet itself** (actual
  roster data, parsed into the matrix on each request) — not the embedded
  sample data anymore. Both the month-picker and the matrix computation are
  fully wired to real data.
- **Hosting decision — made**: Vercel (not Apps Script). This was driven by
  already having built the Next.js app before the hosting question was
  revisited; Apps Script was never actually built and isn't part of this
  codebase.
- **Design — redesigned**: Ofir asked for a cleaner, more professional look
  partway through. The original teal/green + serif (Frank Ruhl Libre) look
  described later in this file (under "reference implementations") is
  **superseded**. Current palette: neutral slate/gray + **indigo** accent
  (`#4f46e5` light / `#818cf8` dark), single sans-serif throughout (**Heebo**
  only, weight 800 for headings, no serif font). The hero photo on the
  landing page was kept but muted (`grayscale(45%) saturate(85%)
  brightness(0.82)` + a neutral-toned scrim, not the original teal-tinted
  one). Tokens live in `web/app/globals.css`. The app icon/favicon/PWA icons
  were later replaced with Ofir's "Tel Aviv Control" logo (source:
  `web/scripts/logo-source.png`, regenerated via `web/scripts/gen-icons.mjs`).
- **Second feature shipped: "איך עבד X?"** (`/how-worked`) — pick an
  employee and a shift count (1–5), see which 2-hour-ish time blocks they
  were scheduled in for their last N *completed* shifts, read live from a
  **third Drive folder** ("סידורים יומיים", daily schedules — separate from
  the two roster folders). See "The daily-schedule data source" section
  below and **`docs/daily-schedule-source.md`** before touching this code —
  it has a real gotcha (block duration/count is not fixed per day).

### Architecture map (`web/`)

```
app/
  page.tsx                    — landing page (hero photo, two menu items:
                                 "סטטיסטיקה חודשית" → /monthly-stats,
                                 "איך עבד X?" → /how-worked)
  login/page.tsx              — sign-in gate UI ("Sign in with Google")
  monthly-stats/
    page.tsx                  — thin server component (metadata only)
    MonthlyStatsClient.tsx    — client: SchedulePicker + live matrix fetch/render
  how-worked/
    page.tsx                  — thin server component (metadata only)
    HowWorkedClient.tsx        — client: employee+count pickers, renders the
                                  unified block-grid table (see below)
  components/
    ShiftMatrix.tsx           — the matrix itself, ported from reference/v2-current.html
    SchedulePicker.tsx        — native <select> of live Drive files, sorted newest-first
  api/
    schedule-files/route.ts   — GET: lists both roster Drive folders live (force-dynamic)
    schedule-matrix/route.ts  — GET ?fileId=...: downloads+parses that roster sheet live
    employees/route.ts         — GET: employee name list from the newest roster file
    employee-schedule/route.ts — GET ?employee=&count=: walks back across months
                                  (roster files) collecting completed shifts, fetches
                                  their daily-schedule blocks, merges into a unified grid
    auth/login/route.ts       — starts the Google sign-in OAuth flow
    auth/callback/route.ts    — exchanges code, checks ALLOWED_EMAILS, sets session cookie
    auth/logout/route.ts      — clears the session cookie
  sw.ts                        — Serwist service worker (PWA)
proxy.ts                       — (Next 16 renamed "middleware" to "proxy") gates every
                                  route except /login, /api/auth/*, and static assets
                                  behind a valid session cookie
lib/
  google-auth.ts               — OAuth2Client for **Drive access** (Desktop-app client,
                                  offline refresh token, env: GOOGLE_OAUTH_CLIENT_ID/
                                  SECRET/REFRESH_TOKEN)
  google-drive.ts               — lists+sorts schedule files from both roster Drive folders
  xlsx-utils.ts                  — shared Drive-download + cell-parsing helpers (extracted
                                  from sheets.ts so daily-schedule.ts can reuse them)
  sheets.ts                     — parses the monthly roster tab (matrix algorithm,
                                  employee names, per-employee work-days)
  daily-schedule.ts              — finds/parses the "סידורים יומיים" daily-schedule
                                  files; block detection is data-driven (see
                                  docs/daily-schedule-source.md), not a fixed row range
  shift-grid.ts                   — merges several days' (possibly different-duration)
                                  block lists into one time-aligned row grid
  date-utils.ts                  — "today" in Israel's timezone + date comparison,
                                  used to exclude not-yet-happened shifts
  auth-login.ts                 — OAuth2Client for the **sign-in gate** (separate
                                  Web-application client, env: GOOGLE_LOGIN_CLIENT_ID/
                                  SECRET, ALLOWED_EMAILS)
  session.ts                    — hand-rolled HMAC-signed session cookie (no JWT lib)
  hebrew-months.ts               — parses "ספטמבר 2026"-style file names ↔ month/year
scripts/
  get-drive-refresh-token.mjs   — one-time local script to mint the Drive refresh token
  gen-icons.mjs / logo-source.png — regenerates PWA icons from one source image
  inspect-daily-schedule.mjs,
  inspect-specific-file(2).mjs,
  test-unified-grid.mjs         — diagnostic tools for the daily-schedule data source,
                                  see docs/daily-schedule-source.md
.env.local.example               — documents every required env var and how to get it
```

**Two separate Google OAuth clients exist in the same Google Cloud project**
— don't confuse them:
1. **Drive access** (`GOOGLE_OAUTH_*`) — "Desktop app" type, offline refresh
   token, authenticates as Ofir's own Google account server-side to read the
   two Drive folders + export sheets. A **service-account key was not used**
   because an org policy (`iam.disableServiceAccountKeyCreation`) blocks key
   creation on this Google Cloud org and Ofir can't override it himself.
2. **Sign-in gate** (`GOOGLE_LOGIN_CLIENT_ID/SECRET`) — "Web application"
   type, used only for the user-facing "Sign in with Google" button. Needs
   its own Authorized redirect URIs registered per environment (both
   `http://localhost:3000/api/auth/callback` and
   `https://accn-p.vercel.app/api/auth/callback` are registered).
   **Already broke once**: editing the consent screen's Branding fields
   (App name/support email/etc.) somehow dropped the `localhost` redirect
   URI, producing `Error 400: redirect_uri_mismatch` on local login only
   (production kept working). Fixed by re-adding it in Cloud Console →
   Credentials → this client → Authorized redirect URIs. If local login
   ever breaks again with that exact error, check this list first before
   assuming something in the code changed.

**Both clients currently sit under the same OAuth consent screen, which is
still in "Testing" publishing status.** Concretely this means:
- Only Google accounts added as **Test users** in that consent screen can
  complete sign-in at all (for *either* client) — regardless of what's in
  `ALLOWED_EMAILS`. Ofir is already a test user. **Adding a new person later
  requires adding them as a Test user in Google Cloud Console *and* to
  `ALLOWED_EMAILS`** — both, not just one.
- The **Drive OAuth refresh token expires after 7 days** while in Testing
  status — this is a real, not-yet-fixed operational risk. The fix is
  publishing the consent screen to "In production" (Cloud Console → OAuth
  consent screen / "Google Auth Platform" → Publish App), which does **not**
  require Google's verification review for this use case, but **does**
  require filling in Homepage URL and Privacy Policy URL in the Branding
  step — blocked earlier only because there was no real domain yet. **Now
  that `https://accn-p.vercel.app` exists, this can be completed** (not yet
  done as of this writing). After publishing, re-run
  `scripts/get-drive-refresh-token.mjs` once to mint a token that isn't
  subject to the 7-day Testing expiry, and update `GOOGLE_OAUTH_REFRESH_TOKEN`
  in Vercel's env vars.
- The sign-in gate itself doesn't have this 7-day problem (it's a normal
  interactive login, not an offline/server-stored token), so it's fine to
  leave in Testing indefinitely if the user list stays small.

### Env vars (see `web/.env.local.example` for full setup instructions)

`GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`,
`GOOGLE_OAUTH_REFRESH_TOKEN`, `GOOGLE_LOGIN_CLIENT_ID`,
`GOOGLE_LOGIN_CLIENT_SECRET`, `ALLOWED_EMAILS`, `SESSION_SECRET` — all seven
are set both in `web/.env.local` (local dev, gitignored) and in the Vercel
project's Environment Variables (production).

A stray file, **`env.txt`** at the repo root, contains a duplicate of some of
these secrets in plain text — it predates git being initialized here, is
excluded via the root `.gitignore`, but should probably just be deleted by
Ofir (not deleted automatically here, in case he wants to check it first).

## What this project is

Ofir manages (or works within) a duty roster for a security/patrol-style team —
~51 people, monthly Google Sheet, Hebrew, RTL. Each person has one shift-code
per day (worked shift, off, vacation, drill, standby, etc.).

The deliverable is a **"shift partner matrix"**: a 51×51 grid, employee names
on the right and on top, that shows — for every pair of employees — how many
days in the month they were both scheduled on an actual duty shift (`x`).
This is now a live web app (see Current Status above), not just the original
static export.

## The data source

- The roster lives across **two Google Drive folders** (see
  `lib/google-drive.ts` for the exact IDs): a "current months" folder
  (flat list of files) and an "archive" folder (one subfolder per year).
  Files are named like `"ספטמבר 2026"` — parsed by `lib/hebrew-months.ts`.
  This fully replaces the old single-hardcoded-file-ID approach; month
  selection is a live picker (`SchedulePicker.tsx` / `/api/schedule-files`),
  refreshed every time the app is opened, per Ofir's explicit request (files
  do get moved between the two folders occasionally).
- Full structure of the roster tab (row/column layout), and all shift-code
  meanings (confirmed and unconfirmed), are documented in
  **`docs/data-source.md`** — read that before touching parsing code.
  `lib/sheets.ts` detects the day-of-month columns and the "מש'" column
  **dynamically** from the header row rather than hardcoding column numbers
  or a 30-day month, so it works correctly for any month length (verified
  against both a 30-day and a 31-day month in production).

## The daily-schedule data source and "איך עבד X?"

A **third, separate Drive folder** — "סידורים יומיים" (daily schedules),
ID `0B8vJAzgBs7x1VG1GUDB2VjhIVmc` — holds one file per month with one tab
per day-of-month, showing hour-by-hour role assignments (not the same as
the monthly roster files). Full layout, and the one real gotcha (block
duration/count varies per day — most days are 12×2h blocks, but at least
one confirmed day uses 16×1.5h blocks), are in
**`docs/daily-schedule-source.md`** — read that before touching
`lib/daily-schedule.ts` or `lib/shift-grid.ts`.

The `/how-worked` feature ("איך עבד X?"), end to end:
1. `/api/employees` gets the employee list from the newest roster file.
2. `/api/employee-schedule?employee=&count=` finds that employee's
   **completed** (not future-scheduled) worked days in the newest roster
   file, and if there aren't enough for the requested count, **walks
   backward across older roster files** (via `listScheduleFiles()`, already
   sorted newest-first across both roster folders) until it has enough or
   hits a 6-month cap.
3. For each collected day, it finds that month's daily-schedule file and
   extracts the employee's blocks (`lib/daily-schedule.ts`).
4. Because different days' blocks can have different durations, the result
   is **not** rendered by row index — `lib/shift-grid.ts` merges all
   selected days into one shared, correctly time-aligned row grid first.
5. Frontend UX (per Ofir, twice-corrected): selecting an employee always
   resets the shift-count choice to unselected, and nothing is fetched
   until **both** an employee and a count are explicitly chosen — no
   fetch-on-employee-select-alone, and no stale count carried over to a
   newly selected employee.
6. "Today" for excluding future-scheduled shifts is computed in **Israel's
   timezone** (`lib/date-utils.ts`), not the server's own (Vercel runs UTC).

## The matrix algorithm (validated in Python, now also in TypeScript)

Fully specified in **`docs/matrix-algorithm.md`**; `lib/sheets.ts` is a
faithful TypeScript port of that same algorithm, run live against the actual
downloaded sheet (via Drive's export endpoint + `exceljs`, not a service
account, not a downloaded-once fixture). Summary:

1. For each day-of-month column, collect the set of employees whose cell for
   that day is `x` or `|x|` (an actual worked shift).
2. For every pair of employees who were both in that day's set, increment a
   co-occurrence counter for that pair, and record the day number.
3. Result: an N×N symmetric matrix of **overlap-day counts**, plus a
   day-list per pair (used for the hover tooltip), plus each employee's
   **total shift count** (the sheet's own `מש'` column).
4. Display format per cell: `overlap/total`, where `total` is **the row
   employee's** total shift count — e.g. `5/8` means "5 of this row's 8
   shifts overlapped with this column's person." This makes the matrix
   **not symmetric as displayed** even though the raw overlap count is
   symmetric. **Still not changed / not built as a toggle** — see Open
   Questions.

## What already exists

`reference/` still contains the two original static HTML prototypes
(`v1-alphabetical.html`, `v2-current.html`, `sample-data.json`) — kept for
reference and as a known-good fixture for testing, but **no longer the
frontend**. `ShiftMatrix.tsx` is the live port of `v2-current.html`'s
behavior (same hover readout, sticky headers, heatmap, vertical Hebrew
column headers), restyled per the redesign described in Current Status.
`sample-data.json` is unused by the live app now (the matrix page fetches
real data) but left in place for testing.

## Important gotcha already solved — don't rediscover it

Getting Hebrew text to read correctly top-to-bottom in a vertical column
header took several iterations — this is preserved exactly in
`ShiftMatrix.module.css`'s `.rot` class:
- `transform: rotate(45deg)` on a horizontal span → works, but diagonal
  (this was v1; superseded by vertical headers).
- `writing-mode: vertical-rl; text-orientation: mixed;` → renders each
  character individually rotated 90°, effectively **mirrored/unreadable**
  for Hebrew. Don't use `mixed`.
- `writing-mode: vertical-rl; text-orientation: upright;` alone → each
  character upright, correctly shaped, but **stacks in reverse order**
  (last letter on top) because the block still inherits `dir="rtl"` from
  the page.
- **Fix that worked**: add `direction: ltr; unicode-bidi: bidi-override;`
  to that same element (on top of `writing-mode: vertical-rl;
  text-orientation: upright;`). This forces top-to-bottom stacking in
  logical (source) character order regardless of the page's overall RTL
  direction.

**A second, smaller bidi gotcha** found in `HowWorkedClient.tsx`: an inline
hour range like `09:00–11:00` rendered **reversed** (`11:00-09:00`) inside
an RTL table cell — the numeric-dash-numeric sequence has no strong
directional anchor, so the browser's bidi algorithm reordered it relative to
the surrounding RTL context. Fix: wrap it in
`<span style={{ direction: "ltr", unicodeBidi: "isolate" }}>`. Any future
inline "number–number" or "number:number-number:number" style label inside
RTL layout should get this same treatment preemptively.

## Privacy constraint — resolved

The matrix contains **real coworkers' names**. Ofir previously declined a
public Claude Artifact link for exactly this reason. **This is now resolved
for the live deployment**: the entire app (every page and every API route,
not just the UI) sits behind `proxy.ts`, which requires a valid signed
session cookie or redirects to `/login`. Sessions are only granted via
Google sign-in to an email present in `ALLOWED_EMAILS` (currently just
`ofir.landshaft@gmail.com`). See the "Two separate Google OAuth clients"
section above for the full mechanism and its current limitations (Testing
mode's test-user list).

Don't weaken or bypass this gate without checking with Ofir first — it's the
whole reason the site can exist at a real, memorable URL instead of staying
unpublished.

## Hosting/architecture — decided

**Vercel**, deploying `web/` (Root Directory = `web`) from
`ofirlandshaft-sys/Accn-p` on GitHub. `docs/deployment-options.md` still
describes the original three-way comparison (GitHub Pages / Vercel / Apps
Script) for historical context, but Apps Script was never built and isn't
relevant anymore — don't resurrect that option without Ofir explicitly
asking. No Vercel MCP connector was available in this Claude Code
environment; deployment was done by driving the Vercel dashboard directly
through the user's real Chrome (via the `claude-in-chrome` tools), since
Claude Code itself had no GitHub/Vercel CLI auth configured.

Refresh latency in production matches the original estimate: on the order of
1–3 seconds dominated by the Drive/Sheets network round-trip, not by the
(trivial) matrix computation.

## Open questions still outstanding

1. **Symmetric vs. row-relative ratio display** — still not decided, still
   only the row-relative `overlap/total` is built. A `min(shifts[i],
   shifts[j])` symmetric toggle was proposed and never built.
2. Several shift codes are **still unconfirmed** (`ע`, `ג`, `ט`, `z`, `אפ`/
   `אע`, `מ.`) — see `docs/data-source.md`. Only `x`/`|x|` (worked shift)
   and `ח` (vacation) are empirically confirmed. Ask Ofir before any new
   feature depends on interpreting these.
3. **Finish publishing the OAuth consent screen to Production** (see above)
   — now unblocked since a real domain exists, but not yet done. Needed to
   stop the Drive refresh token from expiring every 7 days.
4. **Auto-refresh vs. refresh-on-load** — still just refresh-on-load /
   manual "רענון" button for the file list; true polling/push was discussed
   as likely overkill and never revisited.
5. Landing page now has **two** menu items ("סטטיסטיקה חודשית",
   "איך עבד X?"). Ofir has added a second one himself when he had a need for
   it — still don't pre-emptively add more without being asked, but the
   "exactly one, don't grow it" framing from earlier no longer applies.
6. `env.txt` at the repo root (stray plaintext secrets, predates git) —
   flagged to Ofir, not deleted automatically; worth deleting once he
   confirms.
7. The daily-schedule block-duration gotcha (see above) was found by
   spot-checking **one** file Ofir pointed at. It's unknown how many other
   days/months use non-2-hour blocks, or whether even-more-different
   structures (different name-column ranges, more than 2 teams, etc.) exist
   elsewhere. The current code is *robust* to different block durations but
   still assumes the C:M column range and the row-pair-per-block structure
   hold everywhere — if a future bug report suggests wrong data for a
   specific day, check that day's raw structure with
   `scripts/inspect-specific-file.mjs` before assuming the bug is elsewhere.

## Working conventions used so far

- Next.js 16 (App Router, TypeScript), no Tailwind — plain CSS Modules +
  CSS custom properties for theming (`app/globals.css`), matching the
  original static-prototype styling approach but componentized.
- **`proxy.ts`, not `middleware.ts`** — Next.js 16 renamed the convention;
  it defaults to the Node.js runtime now (no Edge-runtime workarounds
  needed for `node:crypto` in `lib/session.ts`).
- Prefer hand-rolled solutions over adding dependencies for small needs
  (session cookies via HMAC instead of a JWT library; OAuth flows via
  `google-auth-library` directly instead of `next-auth`) — keeps the
  dependency surface small and every auth code path auditable.
- `next dev`/`next build` are pinned to `--webpack` (see `package.json`)
  because Serwist (the PWA/service-worker plugin) doesn't support
  Turbopack yet.
- Language: all UI copy is in Hebrew, RTL layout (`dir="rtl"`). Keep it that
  way unless Ofir asks otherwise.
- Playwright/browser-based visual verification (via the Browser pane and,
  for anything requiring Ofir's real logged-in sessions, `claude-in-chrome`)
  was used throughout to verify RTL/vertical-text rendering, the login flow,
  and the live deployment — keep doing this for any UI or auth-flow change
  that's hard to reason about from source alone.
