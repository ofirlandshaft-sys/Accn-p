import "server-only";
import ExcelJS from "exceljs";
import { getAuthClient } from "./google-auth";
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

/** Downloads the sheet as .xlsx via Drive's export endpoint (no separate Sheets API scope needed). */
async function downloadWorkbook(fileId: string): Promise<ExcelJS.Workbook> {
  const auth = getAuthClient();
  const res = await auth.request<ArrayBuffer>({
    url: `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}/export`,
    params: {
      mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    },
    responseType: "arraybuffer",
  });

  const workbook = new ExcelJS.Workbook();
  // exceljs's bundled .d.ts predates @types/node's generic `Buffer<T>`
  // change and declares its own incompatible `Buffer` shape for this param
  // (missing maxByteLength/resizable/etc.) — a real Buffer works fine at
  // runtime, so `any` sidesteps the type-only mismatch.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await workbook.xlsx.load(Buffer.from(res.data) as any);
  return workbook;
}

/** Excel/Sheets store computed formula results alongside the formula itself — unwrap either shape. */
function rawCellValue(value: ExcelJS.CellValue): unknown {
  if (value != null && typeof value === "object") {
    if ("result" in value) return (value as { result?: unknown }).result;
    if ("text" in value) return (value as { text?: unknown }).text;
    if ("richText" in value) {
      return (value as { richText: { text: string }[] }).richText.map((r) => r.text).join("");
    }
  }
  return value;
}

function cellText(cell: ExcelJS.Cell): string {
  const v = rawCellValue(cell.value);
  return v == null ? "" : String(v).trim();
}

const EXCEL_EPOCH_UTC_MS = Date.UTC(1899, 11, 30);

/** Header cells for day columns are dates (Sep 1, Sep 2, ...) — extract the day-of-month number. */
function extractDayNumber(cell: ExcelJS.Cell): number | null {
  const v = rawCellValue(cell.value);
  if (v == null) return null;
  if (v instanceof Date) return v.getUTCDate();
  if (typeof v === "number") {
    if (v >= 1 && v <= 31 && Number.isInteger(v)) return v; // already a plain day number
    const asDate = new Date(EXCEL_EPOCH_UTC_MS + v * 86_400_000);
    return asDate.getUTCDate();
  }
  return null;
}

/**
 * Reads the roster tab of the given Drive file and computes the same
 * shift-partner matrix as the two static prototypes in reference/.
 */
export async function getMonthlyMatrix(fileId: string): Promise<MatrixData> {
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
