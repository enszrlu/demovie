import { type NextRequest, NextResponse } from "next/server";
import { clearSessionCookie } from "@/lib/session";

export function GET(request: NextRequest) {
  const response = NextResponse.redirect(new URL("/login", request.url), 303);
  clearSessionCookie(response);
  return response;
}
