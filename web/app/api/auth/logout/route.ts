import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE_NAME } from "@/lib/session";

export async function GET(request: NextRequest) {
  const res = NextResponse.redirect(new URL("/login", request.nextUrl.origin));
  res.cookies.delete(SESSION_COOKIE_NAME);
  return res;
}
