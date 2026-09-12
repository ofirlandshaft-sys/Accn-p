# The Matrix Algorithm

This is the exact logic used to build `reference/v2-current.html`, written
up as language-agnostic pseudocode plus the actual Python it was prototyped
in. Port this faithfully — it's already validated against the sheet's own
summary numbers (see "Validation" below).

## Inputs

- `names[0..n-1]`: employee names, **in original roster row order** (row 4,
  5, 6, ... of the `סידור` tab — i.e. just read top-to-bottom, don't sort).
- `dayCell[personRow][dayColumn]`: the raw shift-code string for that
  person/day (or blank).
- `totalShifts[person]`: that person's `מש'` column value (their total
  worked-shift count for the month).

## Step 1 — who worked each day

```
for each day in 1..30:
    workers[day] = [ name for name in names
                      if dayCell[name][day] in {"x", "|x|"} ]
```

## Step 2 — pairwise overlap counts + day lists

```
pairDays = {}   # (i, j) with i < j  ->  list of day numbers
for day in 1..30:
    todays = sorted(set(workers[day]))     # de-dup + stable order
    for (a, b) in all_combinations_of_2(todays):
        i, j = index_of(a), index_of(b)
        lo, hi = min(i, j), max(i, j)
        pairDays[(lo, hi)].append(day)

matrix[n][n] = all zeros
for (i, j), days in pairDays.items():
    matrix[i][j] = len(days)
    matrix[j][i] = len(days)   # symmetric — raw overlap count is order-independent
```

`matrix[i][j]` (the raw overlap count) is **symmetric**. What's *displayed*
per cell is not (see Step 3).

## Step 3 — per-cell display value: `overlap/total`

```
for each cell (i, j), i != j:
    display(i, j) = f"{matrix[i][j]}/{totalShifts[names[i]]}"
```

The denominator is **the row employee's own total shift count** — i.e.
reading across row `i` answers "of person `i`'s `totalShifts[i]` shifts,
how many overlapped with each colleague?" This means `display(i, j)` and
`display(j, i)` generally differ (same numerator, different denominator).
Ofir was told this explicitly when it shipped and has not asked for a
change, but flagged an alternative worth offering:

**Alternative (not yet built) — symmetric ratio:**
```
denominator(i, j) = min(totalShifts[i], totalShifts[j])
```
This keeps the *displayed* value symmetric (since `min` doesn't care about
order), and arguably has a cleaner interpretation ("what fraction of the
maximum possible overlap between these two actually happened"). Consider
offering both as a toggle rather than picking one.

Diagonal cells (`i == j`) are not meaningful and were rendered as `—`.

## Step 4 — row/column totals

```
rowSum[i] = sum(matrix[i][j] for j in 0..n-1)   # sum of raw overlap counts
colSum[j] = sum(matrix[i][j] for i in 0..n-1)   # == rowSum[j], matrix is symmetric
grandTotal = sum(rowSum) / 2   # each pair counted once, not twice
```

Displayed as a sticky "total" column (right edge) and "total" row (bottom),
both showing raw overlap sums (not ratios).

## Output data shape (matches `reference/sample-data.json`)

```json
{
  "names": ["לנדאו", "פורן", "..."],
  "matrix": [[0, 1, ...], [1, 0, ...], ...],
  "rowSums": [18, 56, ...],
  "shifts": [2, 7, ...],
  "pairDays": {
    "0-5": [4, 23],
    "1-2": [1],
    "...": "..."
  }
}
```

- `pairDays` keys are `"{i}-{j}"` with `i < j`, values are the list of day
  numbers (1–30) both people had an `x`/`|x|` shift. This is what powers the
  hover tooltip's exact-dates readout.
- `shifts[i]` is `totalShifts` for `names[i]` (the sheet's `מש'` value) —
  used both for the row-header subtitle (`name · N מש'`) and as the ratio
  denominator.

## Reference Python (as actually run during prototyping)

```python
import openpyxl
from itertools import combinations
from collections import defaultdict

wb = openpyxl.load_workbook("schedule.xlsx", data_only=True)
ws = wb["סידור"]

names_order = []
rows_by_name = {}
total_shifts = {}
for r in range(4, 55):
    name = ws.cell(row=r, column=4).value
    if name:
        names_order.append(name)
        rows_by_name[name] = r
        ms = ws.cell(row=r, column=35).value  # מש' column
        total_shifts[name] = int(ms) if ms is not None else 0

work_codes = {"x", "|x|"}
day_workers = {}
for c in range(5, 35):                # columns E..AH = Sep 1..30
    day = c - 4
    workers = []
    for name, r in rows_by_name.items():
        v = ws.cell(row=r, column=c).value
        if v in work_codes:
            workers.append(name)
    day_workers[day] = workers

pair_days = defaultdict(list)
for day, workers in sorted(day_workers.items()):
    for a, b in combinations(sorted(set(workers)), 2):
        pair_days[(a, b)].append(day)

n = len(names_order)
idx = {name: i for i, name in enumerate(names_order)}   # ORIGINAL roster order

matrix = [[0] * n for _ in range(n)]
pairDays = {}
for (a, b), days in pair_days.items():
    i, j = idx[a], idx[b]
    lo, hi = (i, j) if i < j else (j, i)
    matrix[i][j] = len(days)
    matrix[j][i] = len(days)
    pairDays[f"{lo}-{hi}"] = days

row_sums = [sum(row) for row in matrix]
shifts_arr = [total_shifts[name] for name in names_order]
```

## Validation performed

- Summed `x`/`|x|` occurrences per row and compared to that row's own `מש'`
  column value — **exact match** across all 51 rows.
- Summed `ח` occurrences per row and compared to that row's own `העדר`
  column value — **exact match** across all 51 rows.
- Cross-checked `שע'` (hours) = `מש' × 25` — held for every row observed
  (not something the matrix depends on, but useful confirmation the `מש'`
  column means what it appears to mean).

No automated tests exist yet — this was validated by hand, once, against
one month's data. A real implementation should have unit tests against the
`sample-data.json` fixture (or a small synthetic sheet) rather than relying
on manual spot-checks again.
