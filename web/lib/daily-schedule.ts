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

// Per Ofir: only the C12:M35 block matters — 12 two-hour blocks (rows 12-13,
// 14-15, ..., 34-35), start/end time in columns C/D, employee names scattered
// across columns E-M (team/role columns) — we only care *whether* the
// employee's name appears anywhere in a block, not which role/team.
const BLOCK_FIRST_ROW = 12;
const BLOCK_LAST_ROW = 35;
const START_COL = 3; // C
const END_COL = 4; // D
const NAME_SCAN_FIRST_COL = 5; // E
const NAME_SCAN_LAST_COL = 13; // M

export interface DailyBlock {
  start: string;
  end: string;
  worked: boolean;
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
  for (let row = BLOCK_FIRST_ROW; row <= BLOCK_LAST_ROW; row += 2) {
    const start = extractTimeLabel(ws.getRow(row).getCell(START_COL)) ?? "?";
    const end = extractTimeLabel(ws.getRow(row).getCell(END_COL)) ?? "?";

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

/** The 12 two-hour blocks (09:00 -> 09:00 next day) for one employee on one day-of-month. */
export async function getEmployeeBlocksForDay(
  fileId: string,
  day: number,
  employeeName: string,
): Promise<DailyBlock[]> {
  const workbook = await downloadWorkbook(fileId);
  const ws = workbook.getWorksheet(String(day));
  if (!ws) {
    throw new Error(`טאב היום ${day} לא נמצא בקובץ הסידור היומי.`);
  }
  return extractBlocksFromSheet(ws, employeeName);
}

/** Same as getEmployeeBlocksForDay, but for several days at once — downloads the (shared) workbook only once. */
export async function getEmployeeBlocksForDays(
  fileId: string,
  days: number[],
  employeeName: string,
): Promise<Map<number, DailyBlock[]>> {
  const workbook = await downloadWorkbook(fileId);
  const result = new Map<number, DailyBlock[]>();
  for (const day of days) {
    const ws = workbook.getWorksheet(String(day));
    if (!ws) {
      throw new Error(`טאב היום ${day} לא נמצא בקובץ הסידור היומי.`);
    }
    result.set(day, extractBlocksFromSheet(ws, employeeName));
  }
  return result;
}
