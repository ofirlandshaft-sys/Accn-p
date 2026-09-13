import "server-only";

export interface CalendarDate {
  year: number;
  month: number; // 1-12
  day: number;
}

/** "Today" in Israel's local calendar date, regardless of the server's own timezone (Vercel runs in UTC). */
export function getIsraelToday(): CalendarDate {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jerusalem",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = fmt.formatToParts(new Date());
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return { year: get("year"), month: get("month"), day: get("day") };
}

/** True if (year, month, day) is on or before `today` — i.e. already happened, not a future-scheduled entry. */
export function isOnOrBefore(year: number, month: number, day: number, today: CalendarDate): boolean {
  if (year !== today.year) return year < today.year;
  if (month !== today.month) return month < today.month;
  return day <= today.day;
}
