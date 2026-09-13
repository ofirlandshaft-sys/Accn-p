# Data Source: the daily-schedule Google Sheets

Backs the **"איך עבד X?"** feature (`app/how-worked/`, `lib/daily-schedule.ts`).
Read this before touching that code — the structure has at least one real
gotcha (variable block duration) that's easy to silently get wrong.

## Identity

- Drive folder: **"סידורים יומיים"**, ID `0B8vJAzgBs7x1VG1GUDB2VjhIVmc`.
- One file per month, named `"<חודש> <שנה> - סידור יומי"` (e.g.
  `"ספטמבר 2026 - סידור יומי"`) — parses fine with the same
  `lib/hebrew-months.ts` used for the monthly roster files.
- One **tab per day-of-month**, tab name is just the day number as a string
  (`"1"`, `"2"`, ... `"31"`).

## Layout of a day tab

- **Rows 3–7**: a "מבנה" (structure) section — vehicle/post assignments for
  the whole day. **Not used** by the current feature.
- **Row 10**: team headers (`"צוות א'"`, `"צוות ב'"`, possibly more)
  spanning column groups.
- **Row 11**: role headers under each team (`Radio`, `Assist`, `VDU`, ...).
  Columns A/B = `"משך"` (duration), C = `"משעה"` (from-hour), D =
  `"עד שעה"` (to-hour).
- **Rows 12 onward — the block grid** (this is all `lib/daily-schedule.ts`
  reads): **pairs of rows per time block**. On the first row of each pair:
  column C = block start time, column D = block end time (both as
  Excel time-of-day values — see `extractTimeLabel` in `lib/xlsx-utils.ts`),
  and columns **E, G, I, K, M** (odd-numbered offsets from E; F/H/J/L are
  spacer columns) hold the employee name(s) assigned that block. The second
  row of the pair is typically blank in these columns. The block list ends
  at the first row-pair where C/D are blank (a closing marker row) —
  **detect this dynamically, never assume a fixed number of blocks.**
- Beyond column M: a **separate table** (`SO`, `CIC`, `כונן 1/2`,
  `טכנאי 1/2`, `זיהוי`, ...) — fixed day-long role assignments, not
  time-blocked. **Not used** by the current feature (per Ofir: only presence
  in the C:M block grid matters, not which specific role/team).
- **Row ~60**: `"זמני הגעה:"` (arrival times) footer — ignore.

## Gotcha already found — don't rediscover it

**Block duration/count is not fixed.** Most days use **12 blocks of 2 hours**
each (rows 12–35, `09:00→11:00→...→07:00→09:00`), but at least one real day
uses **16 blocks of 1.5 hours** each (rows 12–43) —
`"ינואר 2026 - סידור יומי"`, tab `"2"` (file ID
`1SyzUqCup0x6N9-JopoCwM7Mt8K2GfcqNEmR1mBo2itM`), confirmed via
`scripts/inspect-specific-file.mjs`. **Never hardcode a row range or block
count** — read blocks by walking row-pairs from row 12 and stopping at the
first blank start/end (see `extractBlocksFromSheet` in
`lib/daily-schedule.ts`).

Because different days can legitimately have different block durations, a
table spanning several days **cannot** align columns by row index — it must
align by actual time overlap. See `lib/shift-grid.ts` (`buildUnifiedGrid`),
which merges any number of per-day block lists into one shared, correctly
time-aligned row grid via interval containment. Verified against real data:
merging the January (16×1.5h) day above with a September (12×2h) day for the
same employee produces a correct 24-row combined grid
(`scripts/test-unified-grid.mjs`).

## How this was investigated

`scripts/inspect-daily-schedule.mjs` — lists the folder and dumps a wide/tall
raw grid of the newest file's tab `"1"` (rows/cols + merges). Used to
originally reverse-engineer this whole layout.

`scripts/inspect-specific-file.mjs` / `inspect-specific-file2.mjs` — dump a
*specific* file ID + tab name (used to find the 1.5h-block day above, once
Ofir pointed at a candidate file).

`scripts/test-unified-grid.mjs` — standalone (non-TypeScript) verification
of the block-detection + grid-merge logic against real fetched data, without
needing to go through the full app/API — run this again if either function
changes.
