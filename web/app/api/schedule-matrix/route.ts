import { NextResponse } from "next/server";
import { getMonthlyMatrix } from "@/lib/sheets";

// Always recompute fresh — the roster sheet can be edited at any time.
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const fileId = new URL(request.url).searchParams.get("fileId");
  if (!fileId) {
    return NextResponse.json({ error: "Missing fileId query param" }, { status: 400 });
  }

  try {
    const data = await getMonthlyMatrix(fileId);
    return NextResponse.json(data);
  } catch (err) {
    console.error(`Failed to compute matrix for file ${fileId}:`, err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
