/**
 * Client-safe types for the schedule-file picker. Deliberately has no
 * server-only imports (google-auth-library etc.) so it can be imported from
 * client components without pulling Node-only code into the browser bundle.
 */
export interface ScheduleFile {
  id: string;
  name: string;
  /** Parsed from the file name (see lib/hebrew-months.ts). Null if unparsable. */
  year: number | null;
  month: number | null;
  modifiedTime: string;
  /** Which of the two Drive folders this came from. */
  source: "current" | "archive";
}
