import { NextResponse } from "next/server";
import { listScheduleFiles } from "@/lib/google-drive";
import { getRosterNames } from "@/lib/sheets";

// Employee list always comes from the newest roster file — always fresh.
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const files = await listScheduleFiles();
    const latest = files[0];
    if (!latest) {
      return NextResponse.json({ error: "לא נמצאו קבצי סידור ב-Drive." }, { status: 404 });
    }
    const names = await getRosterNames(latest.id);
    return NextResponse.json({ names, sourceFileName: latest.name });
  } catch (err) {
    console.error("Failed to list employees:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
