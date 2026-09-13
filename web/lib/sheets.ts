import "server-only";
import type ExcelJS from "exceljs";
import { downloadWorkbook, cellText, extractDayNumber } from "./xlsx-utils";
import type { MatrixData } from "./matrix-types";

// See docs/matrix-algorithm.md and docs/data-source.md — this ports that
// exact logic (originally prototyped in Python/openpyxl) to read the roster
// tab live out of the Google Sheet the user picked.
const ROSTER_SHEET_NAME = "סידור";
const NAME_COLUMN = 4; // column D
const FIRST_DAY_COLUMN = 5; // column E
const HEADER_ROW = 3;
const FIRST_EMPLOYEE_ROW = 4;
const WORK_CODES = new Set(["x", "|x|"]);

interface ParsedRoster {
  names: string[];
  shifts: number[];
  employeeRows: number[];
  dayColumns: number[];
  ws: ExcelJS.Worksheet;
}

/** Shared parse of the roster tab: header/day-column detection + employee rows. */
async function parseRoster(fileId: string): Promise<ParsedRoster> {
  const workbook = await downloadWorkbook(fileId);
  const ws = workbook.getWorksheet(ROSTER_SHEET_NAME);
  if (!ws) {
    throw new Error(`הגיליון "${ROSTER_SHEET_NAME}" לא נמצא בקובץ — ייתכן שמבנה הקובץ הזה שונה.`);
  }

  const headerRow = ws.getRow(HEADER_ROW);

  // Day-of-month columns: consecutive, starting at column E, until the
  // header stops looking like a date/day number (that's where "מש'" etc. start).
  const dayColumns: number[] = [];
  for (let col = FIRST_DAY_COLUMN; ; col++) {
    const day = extractDayNumber(headerRow.getCell(col));
    if (day == null) break;
    dayColumns.push(col);
  }
  if (dayColumns.length === 0) {
    throw new Error("לא נמצאו עמודות ימים בגיליון בשורת הכותרות — מבנה הקובץ שונה מהצפוי.");
  }

  // The "מש'" (total worked shifts) column, searched just after the day columns.
  let shiftsColumn: number | null = null;
  const searchStart = dayColumns[dayColumns.length - 1] + 1;
  for (let col = searchStart; col <= searchStart + 10; col++) {
    if (cellText(headerRow.getCell(col)).startsWith("מש")) {
      shiftsColumn = col;
      break;
    }
  }
  if (shiftsColumn == null) {
    throw new Error('לא נמצאה עמודת "מש\'" (סך משמרות) בגיליון.');
  }

  // Employee rows: column D, starting at row 4, until the first blank name.
  const names: string[] = [];
  const employeeRows: number[] = [];
  const shifts: number[] = [];
  for (let row = FIRST_EMPLOYEE_ROW; ; row++) {
    const name = cellText(ws.getRow(row).getCell(NAME_COLUMN));
    if (!name) break;
    names.push(name);
    employeeRows.push(row);
    const shiftsValue = Number(cellText(ws.getRow(row).getCell(shiftsColumn)));
    shifts.push(Number.isFinite(shiftsValue) ? shiftsValue : 0);
  }
  if (names.length === 0) {
    throw new Error("לא נמצאו שורות עובדים בגיליון (עמודה D החל משורה 4).");
  }

  return { names, shifts, employeeRows, dayColumns, ws };
}

/**
 * Reads the roster tab of the given Drive file and computes the same
 * shift-partner matrix as the two static prototypes in reference/.
 */
export async function getMonthlyMatrix(fileId: string): Promise<MatrixData> {
  const { names, shifts, employeeRows, dayColumns, ws } = await parseRoster(fileId);
  const n = names.length;

  // Step 1 (docs/matrix-algorithm.md): who worked each day.
  const dayWorkers: number[][] = dayColumns.map((col) => {
    const workers: number[] = [];
    for (let i = 0; i < n; i++) {
      const code = cellText(ws.getRow(employeeRows[i]).getCell(col));
      if (WORK_CODES.has(code)) workers.push(i);
    }
    return workers;
  });

  // Step 2: pairwise overlap counts + day lists.
  const pairDays: Record<string, number[]> = {};
  dayWorkers.forEach((workers, dayIdx) => {
    const dayNumber = dayIdx + 1;
    for (let a = 0; a < workers.length; a++) {
      for (let b = a + 1; b < workers.length; b++) {
        const lo = Math.min(workers[a], workers[b]);
        const hi = Math.max(workers[a], workers[b]);
        const key = `${lo}-${hi}`;
        if (!pairDays[key]) pairDays[key] = [];
        pairDays[key].push(dayNumber);
      }
    }
  });

  const matrix: number[][] = Array.from({ length: n }, () => new Array(n).fill(0));
  for (const [key, days] of Object.entries(pairDays)) {
    const [i, j] = key.split("-").map(Number);
    matrix[i][j] = days.length;
    matrix[j][i] = days.length;
  }

  // Step 4: row totals (raw overlap sums).
  const rowSums = matrix.map((row) => row.reduce((a, b) => a + b, 0));

  return { names, matrix, rowSums, shifts, pairDays };
}

/** Just the employee name list from a roster file (for the "how did X work" picker). */
export async function getRosterNames(fileId: string): Promise<string[]> {
  const { names } = await parseRoster(fileId);
  return names;
}

/** Day-of-month numbers (ascending) on which this employee had an actual worked shift. */
export async function getEmployeeWorkDays(fileId: string, employeeName: string): Promise<number[]> {
  const { names, employeeRows, dayColumns, ws } = await parseRoster(fileId);
  const idx = names.indexOf(employeeName);
  if (idx === -1) {
    throw new Error(`העובד/ת "${employeeName}" לא נמצא/ה בסידור הזה.`);
  }
  const row = employeeRows[idx];
  const days: number[] = [];
  dayColumns.forEach((col, dayIdx) => {
    const code = cellText(ws.getRow(row).getCell(col));
    if (WORK_CODES.has(code)) days.push(dayIdx + 1);
  });
  return days;
}
