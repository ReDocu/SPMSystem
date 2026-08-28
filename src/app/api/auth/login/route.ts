import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { SESSION_COOKIE, createSessionToken } from "@/lib/auth/session";
import { isPinEnabled } from "@/lib/env";

function pinMatches(input: string, expected: string): boolean {
  const a = Buffer.from(input);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(request: Request) {
  if (!isPinEnabled()) {
    return NextResponse.json({ ok: true, note: "pin_disabled" });
  }

  const { pin } = (await request.json().catch(() => ({}))) as { pin?: string };
  if (typeof pin !== "string" || !pinMatches(pin, process.env.SPM_PIN!)) {
    return NextResponse.json({ ok: false, error: "PIN이 올바르지 않습니다" }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE, createSessionToken(process.env.SPM_SECRET!), {
    httpOnly: true,
    sameSite: "lax",
    maxAge: 30 * 24 * 60 * 60,
    path: "/",
  });
  return response;
}
