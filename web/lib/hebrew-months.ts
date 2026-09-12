/**
 * The roster files are named things like "ספטמבר 2026" — a (Gregorian, not
 * Hebrew-calendar) month name in Hebrew plus a year. This extracts that so
 * files can be sorted chronologically regardless of folder location or
 * Drive metadata.
 */
export const HEBREW_MONTH_NAMES: Record<string, number> = {
  ינואר: 1,
  פברואר: 2,
  מרץ: 3,
  מארס: 3,
  אפריל: 4,
  מאי: 5,
  יוני: 6,
  יולי: 7,
  אוגוסט: 8,
  ספטמבר: 9,
  אוקטובר: 10,
  נובמבר: 11,
  דצמבר: 12,
};

export interface ParsedMonth {
  year: number;
  month: number; // 1-12
}

/**
 * Best-effort parse of a file name like "ספטמבר 2026" or "עותק של אוגוסט 2025".
 * Returns null if no recognizable Hebrew month name + 4-digit year is found —
 * callers should keep such files (don't hide them), just sort them last.
 */
export function parseHebrewMonthYear(name: string): ParsedMonth | null {
  const yearMatch = name.match(/(20\d{2})/);
  if (!yearMatch) return null;
  const year = parseInt(yearMatch[1], 10);

  for (const [monthName, month] of Object.entries(HEBREW_MONTH_NAMES)) {
    if (name.includes(monthName)) {
      return { year, month };
    }
  }
  return null;
}

/** Sort key: higher = more recent. */
export function monthSortKey(parsed: ParsedMonth | null): number | null {
  return parsed ? parsed.year * 12 + parsed.month : null;
}

const MONTH_NAMES_BY_NUMBER = [
  "ינואר",
  "פברואר",
  "מרץ",
  "אפריל",
  "מאי",
  "יוני",
  "יולי",
  "אוגוסט",
  "ספטמבר",
  "אוקטובר",
  "נובמבר",
  "דצמבר",
];

/** "ספטמבר 2026" for month=9, year=2026. */
export function formatHebrewMonthYear(month: number, year: number): string {
  return `${MONTH_NAMES_BY_NUMBER[month - 1] ?? month} ${year}`;
}
