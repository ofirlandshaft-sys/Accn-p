import { NextResponse } from "next/server";
import { listScheduleFiles } from "@/lib/google-drive";
import { getEmployeeWorkDays } from "@/lib/sheets";
import { findDailyScheduleFile, getEmployeeBlocksForDays, type DailyBlock } from "@/lib/daily-schedule";
import { getIsraelToday, isOnOrBefore } from "@/lib/date-utils";
import { buildUnifiedGrid } from "@/lib/shift-grid";

export const dynamic = "force-dynamic";

// Safety cap on how many months we'll walk backward looking for enough
// shifts — normal usage (last 1-5 shifts) should never need more than 1-2.
const MAX_MONTHS_BACK = 6;

interface CollectedDay {
  day: number;
  month: number;
  year: number;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const employee = searchParams.get("employee");
  const countRaw = Number(searchParams.get("count") ?? "3");
  const count = Number.isFinite(countRaw) ? Math.min(Math.max(Math.round(countRaw), 1), 5) : 3;

  if (!employee) {
    return NextResponse.json({ error: "Missing employee query param" }, { status: 400 });
  }

  try {
    const files = await listScheduleFiles(); // newest first, both Drive folders
    if (files.length === 0) throw new Error("לא נמצאו קבצי סידור ב-Drive.");

    const today = getIsraelToday();
    const dailyFileCache = new Map<string, { id: string; name: string } | null>();
    const collected: CollectedDay[] = [];
    let currentMonthCompletedShifts: number | null = null; // stat for the newest month only
    let monthsScanned = 0;

    for (const file of files) {
      if (collected.length >= count || monthsScanned >= MAX_MONTHS_BACK) break;
      if (file.month == null || file.year == null) continue; // unparsable file name — skip

      // A roster file for a month that hasn't started yet (shouldn't normally
      // exist, but guard anyway) has nothing "already worked" in it.
      const isFutureMonth = file.year > today.year || (file.year === today.year && file.month > today.month);
      if (isFutureMonth) continue;

      let workDaysThisFile: number[];
      try {
        workDaysThisFile = await getEmployeeWorkDays(file.id, employee);
      } catch {
        continue; // employee not found in this month's roster — skip it
      }

      const isCurrentRealMonth = file.year === today.year && file.month === today.month;
      const eligibleDays = isCurrentRealMonth
        ? workDaysThisFile.filter((d) => isOnOrBefore(file.year as number, file.month as number, d, today))
        : workDaysThisFile; // any other listed month is entirely in the past already

      if (currentMonthCompletedShifts === null) {
        // First file we successfully parse is the newest one — that's "this month" for the stat line.
        currentMonthCompletedShifts = eligibleDays.length;
      }

      monthsScanned++;

      const key = `${file.year}-${file.month}`;
      let dailyFile = dailyFileCache.get(key);
      if (dailyFile === undefined) {
        dailyFile = await findDailyScheduleFile(file.month, file.year);
        dailyFileCache.set(key, dailyFile);
      }
      if (!dailyFile) continue; // no daily-schedule file for this month — can't show blocks for it

      const remainingNeeded = count - collected.length;
      const daysToTake = eligibleDays.slice(-remainingNeeded).reverse(); // most recent first, within this file
      for (const day of daysToTake) {
        collected.push({ day, month: file.month, year: file.year });
      }
    }

    // Fetch blocks, grouped by month, so each daily-schedule workbook is only downloaded once.
    const byMonthKey = new Map<string, number[]>();
    for (const c of collected) {
      const key = `${c.year}-${c.month}`;
      if (!byMonthKey.has(key)) byMonthKey.set(key, []);
      byMonthKey.get(key)!.push(c.day);
    }

    const blocksByKey = new Map<string, DailyBlock[]>();
    for (const [key, days] of byMonthKey) {
      const dailyFile = dailyFileCache.get(key);
      if (!dailyFile) continue;
      const blocksByDay = await getEmployeeBlocksForDays(dailyFile.id, days, employee);
      for (const [day, blocks] of blocksByDay) {
        blocksByKey.set(`${key}-${day}`, blocks);
      }
    }

    const perColumnBlocks = collected.map((c) => blocksByKey.get(`${c.year}-${c.month}-${c.day}`) ?? []);
    // Different days can use different block durations (e.g. 12x2h vs 16x1.5h) —
    // merge them into one shared, correctly-aligned row grid rather than assuming
    // every column shares the same block boundaries.
    const grid = buildUnifiedGrid(perColumnBlocks);

    return NextResponse.json({
      employee,
      totalWorkDaysThisMonth: currentMonthCompletedShifts ?? 0,
      monthsSpanned: monthsScanned,
      columns: collected,
      rows: grid.rows,
      worked: grid.worked,
    });
  } catch (err) {
    console.error(`Failed to build "how did ${employee} work" view:`, err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
