import { type NextRequest, NextResponse } from "next/server";
import { readDb } from "@/lib/db";
import { verifyPassword } from "@/lib/password";
import { safeNextPath, setSessionCookie } from "@/lib/session";

interface Credentials {
  email: string;
  password: string;
  next: string | null;
}

async function readCredentials(request: NextRequest, isJson: boolean): Promise<Credentials | null> {
  try {
    if (isJson) {
      const body = (await request.json()) as Record<string, unknown> | null;
      return {
        email: typeof body?.email === "string" ? body.email : "",
        password: typeof body?.password === "string" ? body.password : "",
        next: typeof body?.next === "string" ? body.next : null,
      };
    }
    const form = await request.formData();
    const value = (key: string) => {
      const entry = form.get(key);
      return typeof entry === "string" ? entry : null;
    };
    return { email: value("email") ?? "", password: value("password") ?? "", next: value("next") };
  } catch {
    return null;
  }
}

/**
 * Signs in with {email, password[, next]} as JSON or a form post.
 * JSON callers get `{ ok, redirectTo }` (200) or 401; form posts get a 303 redirect.
 */
export async function POST(request: NextRequest) {
  const isJson = (request.headers.get("content-type") ?? "").includes("application/json");
  const credentials = await readCredentials(request, isJson);
  if (!credentials) {
    return NextResponse.json({ ok: false, error: "Send email and password as JSON or form data." }, { status: 400 });
  }

  const db = await readDb();
  const email = credentials.email.trim().toLowerCase();
  const user = db.users.find((candidate) => candidate.email.toLowerCase() === email);
  const valid = user !== undefined && verifyPassword(credentials.password, user.passwordHash);
  const redirectTo = safeNextPath(credentials.next);

  if (!valid) {
    if (isJson) {
      return NextResponse.json({ ok: false, error: "Incorrect email or password." }, { status: 401 });
    }
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("error", "invalid");
    if (credentials.next) loginUrl.searchParams.set("next", redirectTo);
    return NextResponse.redirect(loginUrl, 303);
  }

  const response = isJson
    ? NextResponse.json({ ok: true, redirectTo })
    : NextResponse.redirect(new URL(redirectTo, request.url), 303);
  setSessionCookie(response, user.id, request.nextUrl.protocol === "https:");
  return response;
}
