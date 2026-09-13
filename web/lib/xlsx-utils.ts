import "server-only";
import ExcelJS from "exceljs";
import { getAuthClient } from "./google-auth";

/** Downloads a Drive file as .xlsx via Drive's export endpoint (no separate Sheets API scope needed). */
export async function downloadWorkbook(fileId: string): Promise<ExcelJS.Workbook> {
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
export function rawCellValue(value: ExcelJS.CellValue): unknown {
  if (value != null && typeof value === "object") {
    if ("result" in value) return (value as { result?: unknown }).result;
    if ("text" in value) return (value as { text?: unknown }).text;
    if ("richText" in value) {
      return (value as { richText: { text: string }[] }).richText.map((r) => r.text).join("");
    }
  }
  return value;
}

export function cellText(cell: ExcelJS.Cell): string {
  const v = rawCellValue(cell.value);
  return v == null ? "" : String(v).trim();
}

export const EXCEL_EPOCH_UTC_MS = Date.UTC(1899, 11, 30);

/** Header cells for day columns are dates (Sep 1, Sep 2, ...) — extract the day-of-month number. */
export function extractDayNumber(cell: ExcelJS.Cell): number | null {
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

/** Time-of-day cells (e.g. the daily schedule's "משעה"/"עד שעה" columns) — extract as "HH:MM". */
export function extractTimeLabel(cell: ExcelJS.Cell): string | null {
  const v = rawCellValue(cell.value);
  if (v == null) return null;
  if (v instanceof Date) {
    const hh = String(v.getUTCHours()).padStart(2, "0");
    const mm = String(v.getUTCMinutes()).padStart(2, "0");
    return `${hh}:${mm}`;
  }
  if (typeof v === "number") {
    // Excel time-of-day fraction (0..1), possibly with a whole-day part too.
    const totalMinutes = Math.round((v % 1) * 24 * 60);
    const hh = String(Math.floor(totalMinutes / 60) % 24).padStart(2, "0");
    const mm = String(totalMinutes % 60).padStart(2, "0");
    return `${hh}:${mm}`;
  }
  if (typeof v === "string" && /^\d{1,2}:\d{2}$/.test(v.trim())) return v.trim();
  return null;
}
