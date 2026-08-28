import { NextResponse, type NextRequest } from "next/server";
import { isDbConfigured } from "@/lib/db";
import { createItem } from "@/lib/inbox/repo";

const MAX_CAPTURE_LENGTH = 10_000;

/**
 * 북마클릿 수신 (기획서 §4.4 경로 2, 상세기획 ISSUE-01).
 * PIN 세션 쿠키 대신 전용 캡처 토큰으로 검증한다 — proxy 매처에서 제외됨.
 * window.open GET 방식이라 HTTPS 페이지 → http://localhost 혼합 콘텐츠 제한을 피한다.
 */
function isAuthorized(token: string | null): boolean {
  const expected = process.env.SPM_CAPTURE_TOKEN;
  if (expected) return token === expected;
  return !process.env.SPM_PIN; // 토큰 미설정: PIN 잠금이 없을 때만 개방 (잠금 우회 방지)
}

// 팝업 창에서 열리므로 실패도 사람이 읽을 HTML로 답한다 (성공만 자동 닫힘)
function htmlPage(message: string, autoClose: boolean, status = 200): NextResponse {
  return new NextResponse(
    `<!doctype html><meta charset="utf-8"><body style="font-family:sans-serif;padding:2rem;text-align:center">
     <p>${message}</p>${autoClose ? "<script>setTimeout(()=>window.close(),700)</script>" : ""}</body>`,
    { status, headers: { "Content-Type": "text/html; charset=utf-8" } },
  );
}

export async function GET(request: NextRequest) {
  // 상태 변경 GET의 CSRF 방어 — 북마클릿의 window.open은 문서 내비게이션(document),
  // <img>·fetch 기반 몰래 쓰기는 image/empty라서 여기서 걸러진다 (구형 브라우저는 헤더 없음 → 허용)
  const fetchDest = request.headers.get("sec-fetch-dest");
  if (fetchDest && fetchDest !== "document") {
    return NextResponse.json({ error: "허용되지 않는 요청입니다" }, { status: 403 });
  }

  const params = request.nextUrl.searchParams;
  if (!isAuthorized(params.get("token"))) {
    return htmlPage("캡처 토큰이 올바르지 않습니다 — 설정 › 북마클릿을 다시 설치해주세요", false, 401);
  }
  if (!isDbConfigured()) return htmlPage("DB가 설정되지 않았습니다", false, 503);

  const url = params.get("url")?.trim() ?? "";
  const title = params.get("title")?.trim() ?? "";
  // URL이 앞에 와야 인박스 자동 추정이 '자료'로 잡는다 (기획서 §4.2)
  const rawText = [url, title].filter(Boolean).join(" ").slice(0, MAX_CAPTURE_LENGTH);
  if (!rawText) return htmlPage("캡처할 내용이 비어 있습니다", false, 400);

  try {
    await createItem(rawText, "bookmarklet");
    return htmlPage("SPM 인박스에 저장됨 ✓", true);
  } catch (error) {
    console.error("capture 실패:", error);
    return htmlPage("저장하지 못했습니다 — 잠시 후 다시 시도해주세요", false, 500);
  }
}
