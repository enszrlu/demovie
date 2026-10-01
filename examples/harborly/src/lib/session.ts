import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import type { NextResponse } from "next/server";

export const SESSION_COOKIE = "harborly_session";
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

/** Fixture-only fallback. Set HARBORLY_SESSION_SECRET to override. */
const DEV_SESSION_SECRET = "harborly-dev-session-secret-not-for-production";

export interface SessionPayload {
  uid: string;
  /** Expiry, seconds since the epoch. */
  exp: number;
}

function sessionSecret(): string {
  return process.env.HARBORLY_SESSION_SECRET || DEV_SESSION_SECRET;
}

function sign(body: string): Buffer {
  return createHmac("sha256", sessionSecret()).update(body).digest();
}

/** base64url(JSON {uid, exp}) + "." + base64url(HMAC-SHA256(body)) */
export function createSessionToken(uid: string, nowMs: number = Date.now()): string {
  const payload: SessionPayload = { uid, exp: Math.floor(nowMs / 1000) + SESSION_MAX_AGE_SECONDS };
  const body = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  return `${body}.${sign(body).toString("base64url")}`;
}

export function verifySessionToken(
  token: string | null | undefined,
  nowMs: number = Date.now(),
): SessionPayload | null {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [body, signature] = parts as [string, string];
  const expected = sign(body);
  const actual = Buffer.from(signature, "base64url");
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as Partial<SessionPayload>;
    if (typeof payload.uid !== "string" || typeof payload.exp !== "number") return null;
    if (payload.exp * 1000 <= nowMs) return null;
    return { uid: payload.uid, exp: payload.exp };
  } catch {
    return null;
  }
}

/** Only same-app destinations under /app are honored after login. */
export function safeNextPath(next: string | null | undefined): string {
  if (typeof next !== "string") return "/app";
  if (next === "/app" || next.startsWith("/app/") || next.startsWith("/app?")) return next;
  return "/app";
}

export function setSessionCookie(response: NextResponse, uid: string, secure: boolean): void {
  response.cookies.set(SESSION_COOKIE, createSessionToken(uid), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
    secure,
  });
}

export function clearSessionCookie(response: NextResponse): void {
  response.cookies.set(SESSION_COOKIE, "", { httpOnly: true, sameSite: "lax", path: "/", maxAge: 0 });
}

/** Reads and verifies the session cookie of the current request (Server Components and Server Functions). */
export async function getSession(): Promise<SessionPayload | null> {
  const store = await cookies();
  return verifySessionToken(store.get(SESSION_COOKIE)?.value);
}
