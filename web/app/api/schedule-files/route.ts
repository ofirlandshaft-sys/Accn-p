import { NextResponse } from "next/server";
import { listScheduleFiles } from "@/lib/google-drive";

// The two Drive folders' contents can change at any time (files get moved
// between "current" and "archive"), so this must hit Drive fresh every time
// the app is opened — never cached, never statically optimized.
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const files = await listScheduleFiles();
    return NextResponse.json({ files });
  } catch (err) {
    console.error("Failed to list schedule files from Google Drive:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
