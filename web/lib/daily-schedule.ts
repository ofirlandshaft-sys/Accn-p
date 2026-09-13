import "server-only";
import type ExcelJS from "exceljs";
import { getAuthClient } from "./google-auth";
import { listChildren } from "./google-drive";
import { parseHebrewMonthYear } from "./hebrew-months";
import { downloadWorkbook, cellText, extractTimeLabel } from "./xlsx-utils";

// "סידורים יומיים" — one file per month ("<חודש> <שנה> - סידור יומי"),
// one tab per day-of-month ("1", "2", ...), see scripts/inspect-daily-schedule.mjs
// for how this structure was reverse-engineered.
const DAILY_SCHEDULE_FOLDER_ID = "0B8vJAzgBs7x1VG1GUDB2VjhIVmc";

const SPREADSHEET_MIME_TYPES = new Set([
  "application/vnd.google-apps.spreadsheet",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
]);

// Per Ofir: only the C:M block matters — pairs of rows starting at row 12,
// each pair a time block (start/end in columns C/D on the first row),
// employee names scattered across columns E-M (team/role columns) — we only
// care *whether* the employee's name appears anywhere in a block, not which
// role/team. The block DURATION is not fixed: most days use 2-hour blocks
// (12 blocks, ending row 35), but some use other granularities — e.g. a
// 1.5-hour-block day (16 blocks, ending row 43) was found in the archive.
// So the block count/end row is detected per-sheet, not assumed.
const BLOCK_FIRST_ROW = 12;
const MAX_BLOCKS = 48; // safety cap — covers even 30-minute blocks for a full 24h cycle
const START_COL = 3; // C
const END_COL = 4; // D
const NAME_SCAN_FIRST_COL = 5; // E
const NAME_SCAN_LAST_COL = 13; // M

// Per Ofir: the shift manager for the day is the first employee listed in
// the daily schedule's employee list, always at a fixed cell — T12 — on
// every day tab, regardless of the C:M block structure for that day.
const MANAGER_ROW = 12;
const MANAGER_COL = 20; // T

export interface DailyBlock {
  start: string;
  end: string;
  worked: boolean;
}

export interface DailyScheduleDay {
  blocks: DailyBlock[];
  shiftManager: string;
}

/** Finds the daily-schedule file for a given month/year, if one exists. */
export async function findDailyScheduleFile(month: number, year: number): Promise<{ id: string; name: string } | null> {
  const auth = getAuthClient();
  const files = await listChildren(auth, DAILY_SCHEDULE_FOLDER_ID);
  for (const f of files) {
    if (!SPREADSHEET_MIME_TYPES.has(f.mimeType)) continue;
    const parsed = parseHebrewMonthYear(f.name);
    if (parsed && parsed.month === month && parsed.year === year) {
      return { id: f.id, name: f.name };
    }
  }
  return null;
}

function extractBlocksFromSheet(ws: ExcelJS.Worksheet, employeeName: string): DailyBlock[] {
  const blocks: DailyBlock[] = [];
  for (let i = 0, row = BLOCK_FIRST_ROW; i < MAX_BLOCKS; i++, row += 2) {
    const start = extractTimeLabel(ws.getRow(row).getCell(START_COL));
    const end = extractTimeLabel(ws.getRow(row).getCell(END_COL));
    if (start == null || end == null) break; // reached the closing marker / end of the block list

    let worked = false;
    for (const r of [row, row + 1]) {
      for (let col = NAME_SCAN_FIRST_COL; col <= NAME_SCAN_LAST_COL; col++) {
        if (cellText(ws.getRow(r).getCell(col)) === employeeName) {
          worked = true;
          break;
        }
      }
      if (worked) break;
    }
    blocks.push({ start, end, worked });
  }
  return blocks;
}

function extractShiftManager(ws: ExcelJS.Worksheet): string {
  return cellText(ws.getRow(MANAGER_ROW).getCell(MANAGER_COL));
}

/** The blocks (09:00 -> 09:00 next day) and shift manager for one employee on one day-of-month. */
export async function getEmployeeBlocksForDay(
  fileId: string,
  day: number,
  employeeName: string,
): Promise<DailyScheduleDay> {
  const workbook = await downloadWorkbook(fileId);
  const ws = workbook.getWorksheet(String(day));
  if (!ws) {
    throw new Error(`טאב היום ${day} לא נמצא בקובץ הסידור היומי.`);
  }
  return { blocks: extractBlocksFromSheet(ws, employeeName), shiftManager: extractShiftManager(ws) };
}

/** Same as getEmployeeBlocksForDay, but for several days at once — downloads the (shared) workbook only once. */
export async function getEmployeeBlocksForDays(
  fileId: string,
  days: number[],
  employeeName: string,
): Promise<Map<number, DailyScheduleDay>> {
  const workbook = await downloadWorkbook(fileId);
  const result = new Map<number, DailyScheduleDay>();
  for (const day of days) {
    const ws = workbook.getWorksheet(String(day));
    if (!ws) {
      throw new Error(`טאב היום ${day} לא נמצא בקובץ הסידור היומי.`);
    }
    result.set(day, { blocks: extractBlocksFromSheet(ws, employeeName), shiftManager: extractShiftManager(ws) });
  }
  return result;
}
