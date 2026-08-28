import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth/session";

// PIN 잠금 — SPM_PIN 미설정이면 통과 (화면명세서 §1)
export function proxy(request: NextRequest) {
  if (!process.env.SPM_PIN || !process.env.SPM_SECRET) return NextResponse.next();

  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (token && verifySessionToken(token, process.env.SPM_SECRET)) {
    return NextResponse.next();
  }

  // API fetch가 302를 따라가 로그인 HTML을 res.ok로 받으면 저장 실패가 성공처럼 보인다
  if (request.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "인증이 필요합니다" }, { status: 401 });
  }
  return NextResponse.redirect(new URL("/login", request.url));
}

export const config = {
  matcher: ["/((?!login|api/auth|api/health|api/capture|_next/static|_next/image|favicon.ico|.*\\.svg).*)"],
};
