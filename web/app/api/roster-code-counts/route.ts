import { NextResponse } from "next/server";
import { listScheduleFilesForYear } from "@/lib/google-drive";
import { getCodeCounts } from "@/lib/sheets";

// One calendar year's worth of files per request, on purpose — see the
// comment on listScheduleFilesForYear() for why: this backs any report that
// scans multiple years (RosterCodeCountReport.tsx calls it once per year and
// merges the results), rather than one request scanning every year (measured
// to take 14+ seconds for 2016-2026, over Vercel's serverless function time
// budget).
export const dynamic = "force-dynamic";

const OLDEST_YEAR = 2000; // sanity floor only — callers pick their own real cutoff

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  const yearRaw = Number(searchParams.get("year"));
  const currentYear = new Date().getUTCFullYear();
  if (!Number.isInteger(yearRaw) || yearRaw < OLDEST_YEAR || yearRaw > currentYear + 1) {
    return NextResponse.json({ error: "Missing or invalid year query param" }, { status: 400 });
  }
  const year = yearRaw;

  const codesRaw = searchParams.get("codes") ?? "";
  const codes = codesRaw
    .split(",")
    .map((c) => c.trim())
    .filter(Boolean);
  if (codes.length === 0) {
    return NextResponse.json({ error: "Missing codes query param" }, { status: 400 });
  }

  try {
    const files = await listScheduleFilesForYear(year);

    const counts: Record<string, number> = {};
    let filesFailed = 0;

    await Promise.all(
      files.map(async (file) => {
        let fileCounts: Map<string, number>;
        try {
          fileCounts = await getCodeCounts(file.id, codes);
        } catch {
          filesFailed++; // an unexpectedly-structured old file — skip it rather than fail the whole year
          return;
        }
        for (const [name, count] of fileCounts) {
          if (count === 0) continue;
          counts[name] = (counts[name] ?? 0) + count;
        }
      }),
    );

    return NextResponse.json({ year, counts, filesScanned: files.length, filesFailed });
  } catch (err) {
    console.error(`Failed to build code-count report for ${year} (codes: ${codes.join(",")}):`, err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
