# Data Source: the roster Google Sheet

## Identity

- Title: `ספטמבר 2026` (Hebrew: "September 2026")
- File ID: `1Eg1aPaYda6_tSrMcQ-Z7EzTPcLswbuGrJxnObmCCZFw`
- MIME type: `application/vnd.google-apps.spreadsheet`
- Owner: `bakarazafon@gmail.com`
- Shared with / viewed by: `ofir.landshaft@gmail.com`
- This is a **monthly document** — expect a new/renamed file each month
  following the same internal layout. Don't assume this exact file ID or
  title stays valid forever.

## Tabs in the workbook

| Tab name  | Purpose                                                             |
|-----------|----------------------------------------------------------------------|
| `סידור`   | **Main roster** — the one the matrix is built from. See below.      |
| `logbook` | Free-text version/change history for the sheet itself (not data).   |
| `נסיעות`  | Per-day role/vehicle totals (מנמ"ש, סרמ"ש counts, "תנועות" figure). |
| `OJTI`    | A **separate, static** instructor↔trainee (מדריך/חניך) pairing list — 11 fixed pairs, unrelated to the shift-overlap matrix. Don't confuse this with the matrix; a user asked about it once and it was clarified as a different thing. |
| `workPlan`| Planned-activity table (inspectors, date range, notes) — empty/unfilled as of this writing. |

## Layout of the `סידור` tab (1-indexed rows/columns, as read via `openpyxl`)

- **Row 2**: weekday abbreviations (`'ג`, `'ד`, `'ה`, `'ו`, `'ש`, `'א`, `'ב`
  = Tue, Wed, Thu, Fri, Sat, Sun, Mon), one per day column.
- **Row 3**: header row. Column D = month/year label; columns **E through
  AH (columns 5–34)** = day-of-month dates 1–30 (stored as datetime cells);
  columns after that (35–39) are named `מש'`, `sby`, `סופש`, `העדר`, `שע'`
  (see below).
- **Rows 4–54**: one row per employee (51 people as of this sheet).
  - **Column C** (index 3): employee ID number.
  - **Column D** (index 4): employee **name** — this is the display name
    used everywhere in the matrix.
  - **Columns E–AH (index 5–34)**: one cell per day of the month (Sep
    1–30), containing a **shift code** (see table below) or blank.
  - **Column 35, header `מש'`**: total shift count for that employee this
    month (an integer). This is the sheet's own precomputed count of `x`/
    `|x|` cells in that row — **used as the denominator in the matrix's
    ratio display**.
  - **Column 36, header `sby`**: standby (`s`) count.
  - **Column 37, header `סופש`**: weekend-shift count.
  - **Column 38, header `העדר`**: absence count (empirically, this counts
    `ח` — vacation/leave — occurrences in the row).
  - **Column 39, header `שע'`**: total hours for the month. Empirically
    `hours = shifts (מש') × 25`, i.e. each worked shift appears to be
    valued at a flat 25 hours. (Observed from the data, not confirmed by
    Ofir — flag as an assumption if it matters for a new feature.)
- **Rows ~55–63** (right after the roster): a second small table repeating
  the day-of-week/day-number header, then daily aggregate rows: `מנמ"ש`,
  `סרמ"ש` (role headcounts), `x` (total people working that day), `z`,
  `s` (standby), `סה"כ` (daily total), and `תנועות 15%-` (a numeric
  "movements" figure per day). **Not currently used by the matrix**, but
  potentially useful for a future "daily coverage" view.

## Shift codes observed in the day columns

| Code         | Meaning                          | Confidence |
|--------------|-----------------------------------|------------|
| `x` / `\|x\|` | **Worked shift** (on duty)       | **Confirmed** — matches the row's own `מש'` total exactly when counted. |
| `ח` (also seen as `ח.`) | **Vacation / leave**   | **Confirmed** — matches the row's own `העדר` total exactly when counted. |
| (blank)      | Not scheduled / day off, non-absence | Inferred, not explicitly confirmed |
| `פ`          | Frequently occurring; likely "available/free" (`פנוי`) | Unconfirmed |
| `s` / `s1` / `s2` / `s3` | **Standby** ("כוננות") — all four variants | **Confirmed by Ofir** (used by the `/standby` report, `lib/sheets.ts`'s `getCodeCounts`). `s` alone also matches the `sby` summary column. |
| `ת`          | Likely a drill/exercise (`תרגיל`) | Unconfirmed |
| `ע`          | Unknown — possibly a different duty type | **Unconfirmed — ask Ofir** |
| `ג`          | Unknown | **Unconfirmed — ask Ofir** |
| `ט`          | Unknown (appears in contiguous blocks for one person) | **Unconfirmed — ask Ofir** |
| `z`          | Unknown (also referenced in the `logbook` tab as "באג ספירת (z)" — i.e. there was a known counting *bug* around this code historically) | **Unconfirmed — ask Ofir** |
| `אפ` / `אע`  | Unknown, two similar variants | **Unconfirmed — ask Ofir** |
| `מ` / `מ.` / `.מ` | **Sick day** ("מחלה") — all three variants | **Confirmed by Ofir** (used by the `/sick-days` report, `lib/sheets.ts`'s `getCodeCounts`) |

**`x`/`|x|` and `ח` have been empirically validated** (their counts match
existing summary columns exactly), and **`מ`/`מ.`/`.מ` and
`s`/`s1`/`s2`/`s3` were confirmed directly by Ofir** (no summary column to
cross-check the sick codes against; `s` alone does have one). Everything
else is a reasonable guess. If a future feature needs to interpret any of
the remaining unconfirmed codes correctly, ask Ofir rather than assuming.

## How this was read during prototyping

`openpyxl` (Python), loading the file via `download_file_content` (Drive
API, exported as `.xlsx`) and reading with `data_only=True` to get computed
values rather than formulas. A real web app should use the Google Sheets
API (or Drive API export) directly rather than round-tripping through a
downloaded `.xlsx`, but the row/column layout described above will be the
same either way.
