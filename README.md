# Shift Partner Matrix

A live web-app version of a "who works with whom, how often" matrix built
from a monthly Hebrew duty-roster Google Sheet.

**Start here if you're picking this up in Claude Code: read `CLAUDE.md`
first**, then `docs/` as needed. This README is just a human-facing map of
the repo.

## What's in this repo

```
CLAUDE.md                       ← full project context for Claude Code — read this first
README.md                       ← you are here
docs/
  data-source.md                ← the Google Sheet's exact layout & shift codes
  matrix-algorithm.md           ← the co-occurrence algorithm, pseudocode + reference Python
  deployment-options.md         ← Vercel vs. Apps Script vs. GitHub Pages write-up
reference/
  v1-alphabetical.html          ← first working prototype (superseded)
  v2-current.html               ← current prototype — open this in a browser to see the target UI/UX
  sample-data.json              ← known-good {names, matrix, rowSums, pairDays, shifts} for one real month, for testing without live Sheets access
```

## Status

Two static, self-contained HTML prototypes exist and are approved
(`reference/v2-current.html` is the current one). **Nothing live/dynamic has
been built yet.** The next step is turning this into an app that fetches the
roster Sheet on demand (or on a schedule) and rebuilds the same view —
see `CLAUDE.md` for the open questions that need answers before/while doing
that (hosting choice, month selection, access control, a couple of
unconfirmed shift codes).

## Quick look at the target UI

Open `reference/v2-current.html` directly in a browser — no server needed,
it's fully self-contained (data included inline). That's the UI/UX bar for
whatever the live version becomes.
