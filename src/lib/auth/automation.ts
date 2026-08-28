import type { NextRequest } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth/session";

/**
 * 자동화 진입점(북마클릿·로컬 스케줄러) 공용 인증 — PIN 세션 쿠키 대신 토큰.
 * SPM_CAPTURE_TOKEN이 있으면 일치해야 하고, 없으면 PIN 잠금이 없을 때만 개방.
 */
export function isAutomationAuthorized(token: string | null): boolean {
  const expected = process.env.SPM_CAPTURE_TOKEN;
  if (expected) return token === expected;
  return !process.env.SPM_PIN;
}

/**
 * 브라우저에서 온 요청이면 PIN 세션으로도 통과시킨다 (설정 화면의 [테스트 발송] 버튼).
 * PIN 잠금이 없으면 세션이라는 개념 자체가 없으므로 false —
 * true를 돌려주면 설정된 자동화 토큰이 통째로 우회된다 (fail-open 금지).
 */
export function hasValidSession(request: NextRequest): boolean {
  if (!process.env.SPM_PIN || !process.env.SPM_SECRET) return false;
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  return Boolean(token && verifySessionToken(token, process.env.SPM_SECRET));
}
