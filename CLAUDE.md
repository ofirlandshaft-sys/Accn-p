# Shift Partner Matrix — Project Context

> This file is written for Claude Code. It captures everything decided in a prior
> planning conversation (in Claude, not Claude Code) so a fresh session here can
> continue the work without re-deriving it. Read this file plus everything in
> `docs/` before writing code.

## What this project is

Ofir manages (or works within) a duty roster for a security/patrol-style team —
~51 people, monthly Google Sheet, Hebrew, RTL. Each person has one shift-code
per day (worked shift, off, vacation, drill, standby, etc.).

The deliverable so far has been a **"shift partner matrix"**: a 51×51 grid,
employee names on the right and on top, that shows — for every pair of
employees — how many days in the month they were both scheduled on an actual
duty shift (`x`). Two static HTML prototypes of this already exist and work
(see `reference/`). **The next step Ofir wants explored is turning this into a
live web app** that re-reads the Google Sheet and rebuilds the matrix on
demand, instead of a one-off static export.

This is the primary near-term goal for this repo: **a small web app that (1)
reads the roster Google Sheet, (2) computes the same matrix the prototypes
compute, (3) renders it with the same look/interactions as the prototypes.**

## The data source

- **File**: Google Sheet titled "ספטמבר 2026" (September 2026 roster).
- **File ID**: `1Eg1aPaYda6_tSrMcQ-Z7EzTPcLswbuGrJxnObmCCZFw`
- **Owner**: `bakarazafon@gmail.com` (shared with Ofir — `ofir.landshaft@gmail.com`).
- This is a **live, monthly-recurring document** — a new one presumably exists
  or will exist for each month. Don't hardcode "September 2026" logic; the
  sheet name / month will change. Ask Ofir how he wants month selection to
  work (latest file in a folder? a fixed file ID per month? file picker?).
- Full structure, column layout, and all shift-code meanings (confirmed and
  unconfirmed) are documented in **`docs/data-source.md`** — read that before
  writing any parsing code.

## The matrix algorithm (already validated in Python)

Fully specified in **`docs/matrix-algorithm.md`**, including the exact logic
used to build the two reference HTML files. Summary:

1. For each of the ~30 day-columns, collect the set of employees whose cell
   for that day is `x` or `|x|` (an actual worked shift).
2. For every pair of employees who were both in that day's set, increment a
   co-occurrence counter for that pair, and record the day number.
3. Result: an N×N symmetric matrix of **overlap-day counts**, plus a
   day-list per pair (used for the hover tooltip), plus each employee's
   **total shift count** (the sheet's own `מש'` column).
4. Display format per cell (as of the latest iteration): `overlap/total`,
   where `total` is **the row employee's** total shift count — e.g. `5/8`
   means "5 of this row's 8 shifts overlapped with this column's person."
   This makes the matrix **not symmetric as displayed** (cell[i][j] ≠
   cell[j][i] in general, because the denominator differs per row) even
   though the raw overlap count is symmetric. Ofir was told this explicitly
   and did not ask to change it — but flagged as a possible follow-up: an
   alternative symmetric option (denominator = `min(shifts[i], shifts[j])`)
   was proposed and Ofir may still want that as a toggle. **Confirm with him
   before assuming which is wanted long-term**, or better, support both and
   let it be a UI toggle.

## What already exists (reference implementations)

`reference/` contains two working, self-contained HTML files (no build step,
inline CSS/JS, data embedded as a JSON `<script>` tag) that were hand-built
and visually verified with Playwright screenshots:

- `v1-alphabetical.html` — first version. Names sorted alphabetically,
  diagonal (45°) column headers.
- `v2-current.html` — **current/final version**, matches all of Ofir's
  requested changes:
  - Column headers are **vertical** (`writing-mode: vertical-rl;
    text-orientation: upright;` plus `direction: ltr; unicode-bidi:
    bidi-override;` on the rotated span — see the "gotcha" note below).
  - Employee order matches the **original roster row order** (not
    alphabetical).
  - Cells show `overlap/total` per the algorithm above.
  - Row headers show `name · N מש'` (N = that employee's total shifts).
  - Hover a cell → a readout panel above the table shows the two names, the
    overlap count out of the row person's total, and the exact date list
    (`תאריכים: 4.9, 12.9, …`).
  - Sticky header row + sticky right-hand name column + sticky bottom totals
    row, heatmap background color by raw overlap count, full light/dark
    theme support.
  - `sample-data.json` — the exact `{names, matrix, rowSums, pairDays,
    shifts}` payload currently embedded in `v2-current.html`, extracted so
    you can test a new frontend/backend against known-good numbers without
    needing live Sheets access yet.

**Reuse this HTML/CSS/JS as the frontend rather than redesigning it.** Ofir
has already approved this look (RTL Hebrew layout, Heebo + Frank Ruhl Libre
fonts from Google Fonts, teal accent palette, light/dark theme tokens). The
only thing that should change for the web-app version is *where the JSON
data comes from* (live fetch instead of an embedded `<script>` tag).

## Important gotcha already solved — don't rediscover it

Getting Hebrew text to read correctly top-to-bottom in a vertical column
header took several iterations:
- `transform: rotate(45deg)` on a horizontal span → works, but diagonal
  (this was v1; Ofir asked for vertical instead).
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
  direction. This is the combination used in `v2-current.html` — copy it
  rather than re-deriving.

## Privacy constraint (non-negotiable, already enforced once)

The matrix contains **real coworkers' names**. When asked to publish this as
a Claude Artifact (a shareable-by-link hosted page), **the user explicitly
declined** — real names on a page that's "one share away from anyone" was
not acceptable. He asked for a local HTML file instead, which was sent
directly as a downloadable file (not hosted).

**Carry this constraint into the web app.** Whatever gets built must not be
a publicly-accessible URL with no access control. Concretely, whatever
hosting option gets picked needs one of:
- Authentication / access control (password, allowlisted Google accounts,
  Vercel deployment protection, etc.), or
- Staying fully private (e.g. a Google Apps Script web app restricted to
  specific Google accounts — see below), or
- Explicit sign-off from Ofir if he decides a given exposure level is fine
  for a given hosting choice.

Don't deploy anything publicly-reachable without checking this with him
first.

## Hosting/architecture options already discussed with Ofir

Full write-up in **`docs/deployment-options.md`**. Short version:

1. **GitHub Pages alone — ruled out.** Static-only hosting, no server-side
   code, nowhere to safely hold Google API credentials. Not sufficient by
   itself for live-fetching a private Sheet.
2. **Vercel — recommended default**, if that path is chosen. Serverless
   functions can hold the Google credential as an environment variable,
   fetch the Sheet server-side, compute the matrix, and return JSON (or
   render the page). Supports Cron Jobs for polling on an interval if
   "live" needs to mean "auto-refreshing" rather than "refresh on load."
   Still uses GitHub for source control — Vercel deploys from a connected
   GitHub repo — so it's "GitHub *and* Vercel," not either/or.
3. **Google Apps Script — flagged as possibly the best fit**, specifically
   *because* the data already lives in a Google Sheet: Apps Script runs
   inside Google, reads the Sheet directly via `SpreadsheetApp` with no
   separate credential/OAuth setup, can serve a small web page via
   `doGet()`, and access can be restricted to specific Google accounts
   through the deployment settings — which also directly satisfies the
   privacy constraint above with no extra auth code to write.
4. **This Claude environment has a Vercel MCP connector available**
   (tools like `mcp__Vercel__deploy_to_vercel`, `create_git_project`,
   `list_projects`, etc. were visible mid-conversation). If Claude Code has
   the same connector available, deploying to Vercel could potentially be
   done directly from a session here rather than manually — worth checking
   what's available before assuming a manual CLI deploy is needed.

**No final decision was made between Vercel and Apps Script** — this is the
first open question to resolve with Ofir when picking this project back up.
Given the privacy constraint and that the data source is 100% Google
Sheets, Apps Script deserves serious consideration even though it's a less
"standard web app" stack.

Estimated latency for a live rebuild (order of magnitude, discussed but not
benchmarked): **~1–3 seconds** per refresh — dominated by the network
round-trip to fetch the Sheet, not by computing the matrix (which is
microseconds-scale for 51 people × 30 days, and would stay trivial even at
10× that size).

## Open questions to raise with Ofir before/while building

1. Vercel vs. Apps Script (or something else) — see above.
2. How should month selection work once this is live and roster files
   change monthly (fixed file ID vs. "latest file in folder X" vs. a picker)?
3. Auto-refresh (polling every N seconds/minutes) vs. refresh-on-load vs. a
   manual refresh button — "true real-time" push updates were mentioned as
   possible but likely overkill for a monthly file that changes
   occasionally.
4. Symmetric vs. row-relative ratio display (see algorithm section above) —
   confirm which he actually wants, or build both as a toggle.
5. Several shift codes are **still unconfirmed** (`ע`, `ג`, `ט`, `z`, `אפ`/
   `אע`, `מ.`) — see `docs/data-source.md`. Only `x`/`|x|` (worked shift)
   and `ח` (vacation) were empirically confirmed against the sheet's own
   summary columns. If any future feature needs these other codes, ask Ofir
   what they mean rather than guessing.
6. Access-control mechanism for whichever hosting choice is made (see
   Privacy Constraint above) — must be resolved before any real deployment,
   not left implicit.

## Working conventions used so far (carry forward if it stays useful)

- Vanilla HTML/CSS/JS, no framework, no build step, for the prototypes —
  intentional, since the whole first artifact needed to be a single
  portable file. Once this is an actual web app with a backend, a framework
  is fine if it helps; this is not a hard constraint, just what was
  expedient for a static prototype.
- Playwright (`chromium` at `/opt/pw-browsers/chromium`) was used
  server-side to screenshot the HTML during development and visually verify
  RTL/vertical-text rendering before delivering it. Worth doing the same
  here for any UI change that's hard to reason about from source alone
  (RTL bidi text is exactly this kind of thing, as the gotcha above shows).
- Language: all UI copy is in Hebrew, RTL layout (`dir="rtl"`). Keep it that
  way unless Ofir asks otherwise.
