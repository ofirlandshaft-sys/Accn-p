import { NextResponse } from "next/server";
import { listScheduleFiles } from "@/lib/google-drive";
import { getEmployeeWorkDays } from "@/lib/sheets";
import { findDailyScheduleFile, getEmployeeBlocksForDays } from "@/lib/daily-schedule";
import { getIsraelToday, isOnOrBefore } from "@/lib/date-utils";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const employee = searchParams.get("employee");
  const countRaw = Number(searchParams.get("count") ?? "3");
  const count = Number.isFinite(countRaw) ? Math.min(Math.max(Math.round(countRaw), 1), 5) : 3;

  if (!employee) {
    return NextResponse.json({ error: "Missing employee query param" }, { status: 400 });
  }

  try {
    const files = await listScheduleFiles();
    const latest = files[0];
    if (!latest) throw new Error("לא נמצאו קבצי סידור ב-Drive.");
    if (latest.month == null || latest.year == null) {
      throw new Error(`לא ניתן לזהות חודש/שנה מתוך שם הקובץ "${latest.name}".`);
    }

    const allWorkDays = await getEmployeeWorkDays(latest.id, employee); // ascending
    // Only count shifts that have actually happened — the roster can contain
    // the rest of the (still in-progress) month too, scheduled but not yet worked.
    const today = getIsraelToday();
    const workDays = allWorkDays.filter((day) => isOnOrBefore(latest.year as number, latest.month as number, day, today));
    const lastDays = workDays.slice(-count).reverse(); // most recent first

    const dailyFile = await findDailyScheduleFile(latest.month, latest.year);
    if (!dailyFile) {
      throw new Error(`לא נמצא קובץ "סידור יומי" עבור ${latest.month}/${latest.year}.`);
    }

    const blocksByDay = await getEmployeeBlocksForDays(dailyFile.id, lastDays, employee);
    const shifts = lastDays.map((day) => ({
      day,
      month: latest.month as number,
      year: latest.year as number,
      blocks: blocksByDay.get(day) ?? [],
    }));

    return NextResponse.json({
      employee,
      monthlyFileName: latest.name,
      dailyFileName: dailyFile.name,
      totalWorkDaysThisMonth: workDays.length,
      shifts,
    });
  } catch (err) {
    console.error(`Failed to build "how did ${employee} work" view:`, err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
