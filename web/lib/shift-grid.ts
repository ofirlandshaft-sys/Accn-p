import type { DailyBlock } from "./daily-schedule";

export interface UnifiedRow {
  start: string;
  end: string;
}

export interface UnifiedGrid {
  rows: UnifiedRow[];
  /** worked[rowIndex][columnIndex] */
  worked: boolean[][];
}

const CYCLE_MINUTES = 24 * 60;
const CYCLE_START_HOUR = 9; // the block grid runs 09:00 -> 09:00 next day

/** "HH:MM" -> minutes since 09:00, wrapped so 09:00=0 and 08:59=1439. */
function minutesSinceCycleStart(hhmm: string): number | null {
  const match = hhmm.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const h = Number(match[1]);
  const m = Number(match[2]);
  return ((h * 60 + m - CYCLE_START_HOUR * 60) % CYCLE_MINUTES + CYCLE_MINUTES) % CYCLE_MINUTES;
}

function cycleMinutesToLabel(minutesSinceStart: number): string {
  const total = (CYCLE_START_HOUR * 60 + minutesSinceStart) % CYCLE_MINUTES;
  const hh = String(Math.floor(total / 60)).padStart(2, "0");
  const mm = String(total % 60).padStart(2, "0");
  return `${hh}:${mm}`;
}

/**
 * Merges several days' block lists — which may use different block
 * durations/counts (e.g. a 12x2h day alongside a 16x1.5h day) — into one
 * shared row grid, fine enough to respect every day's own block boundaries.
 * Each cell is true if the employee worked during that slice, per that
 * column's own (possibly coarser) block covering it.
 */
export function buildUnifiedGrid(perColumnBlocks: DailyBlock[][]): UnifiedGrid {
  const boundaries = new Set<number>([0, CYCLE_MINUTES]);

  const parsedByColumn = perColumnBlocks.map((blocks) =>
    blocks
      .map((b) => {
        const start = minutesSinceCycleStart(b.start);
        let end = minutesSinceCycleStart(b.end);
        if (start == null || end == null) return null;
        if (end === 0) end = CYCLE_MINUTES; // "09:00" as an end time means end-of-cycle, not start-of-cycle
        return { start, end, worked: b.worked };
      })
      .filter((b): b is { start: number; end: number; worked: boolean } => b != null),
  );

  for (const blocks of parsedByColumn) {
    for (const b of blocks) {
      boundaries.add(b.start);
      boundaries.add(b.end);
    }
  }

  const sortedBoundaries = [...boundaries].sort((a, b) => a - b);
  const rows: UnifiedRow[] = [];
  for (let i = 0; i < sortedBoundaries.length - 1; i++) {
    rows.push({
      start: cycleMinutesToLabel(sortedBoundaries[i]),
      end: cycleMinutesToLabel(sortedBoundaries[i + 1]),
    });
  }

  const worked: boolean[][] = rows.map(() => perColumnBlocks.map(() => false));

  parsedByColumn.forEach((blocks, colIdx) => {
    for (const b of blocks) {
      if (!b.worked) continue;
      for (let rowIdx = 0; rowIdx < rows.length; rowIdx++) {
        const rowStart = sortedBoundaries[rowIdx];
        const rowEnd = sortedBoundaries[rowIdx + 1];
        // This block fully contains the (finer) row slice -> the row inherits its "worked" status.
        if (rowStart >= b.start && rowEnd <= b.end) {
          worked[rowIdx][colIdx] = true;
        }
      }
    }
  });

  return { rows, worked };
}

export interface GroupedTable {
  /** Indices into the original perColumnBlocks array, in their original order. */
  columnIndices: number[];
  rows: UnifiedRow[];
  worked: boolean[][];
}

function blockBoundarySignature(blocks: DailyBlock[]): string {
  const bounds = new Set<number>();
  for (const b of blocks) {
    const start = minutesSinceCycleStart(b.start);
    let end = minutesSinceCycleStart(b.end);
    if (start == null || end == null) continue;
    if (end === 0) end = CYCLE_MINUTES;
    bounds.add(start);
    bounds.add(end);
  }
  return [...bounds].sort((a, b) => a - b).join(",");
}

/**
 * Per Ofir: when the days requested don't all share the same hour scheme,
 * a single merged grid (buildUnifiedGrid) produces extra narrow rows that
 * only exist to accommodate one oddly-shaped day. Prefer this instead for
 * display: group columns that share an *identical* set of block boundaries,
 * and build one (naturally-grained) table per group. A column with a block
 * scheme found nowhere else among the selection gets its own single-column
 * table. Group order follows first appearance in perColumnBlocks.
 */
export function buildGroupedGrids(perColumnBlocks: DailyBlock[][]): GroupedTable[] {
  const groups = new Map<string, number[]>();
  perColumnBlocks.forEach((blocks, idx) => {
    const sig = blockBoundarySignature(blocks);
    if (!groups.has(sig)) groups.set(sig, []);
    groups.get(sig)!.push(idx);
  });

  const tables: GroupedTable[] = [];
  for (const columnIndices of groups.values()) {
    const grid = buildUnifiedGrid(columnIndices.map((idx) => perColumnBlocks[idx]));
    tables.push({ columnIndices, rows: grid.rows, worked: grid.worked });
  }
  return tables;
}
