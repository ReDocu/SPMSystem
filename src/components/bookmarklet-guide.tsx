"use client";

import { useSyncExternalStore } from "react";

const subscribeNoop = () => () => {};

// 북마클릿 설치 안내 (기획서 §4.4 경로 2) — 링크를 북마크바로 드래그해서 설치
export function BookmarkletGuide({
  token,
  pinEnabled,
}: {
  token: string | null;
  pinEnabled: boolean;
}) {
  // origin은 브라우저에만 존재 — SSR은 null로 렌더하고 클라이언트에서 채운다
  const origin = useSyncExternalStore(
    subscribeNoop,
    () => window.location.origin,
    () => null,
  );
  if (!origin) return null;

  // PIN 잠금 상태에서 토큰이 없으면 /api/capture가 전부 401 — 죽은 링크 대신 설정 안내
  if (pinEnabled && !token) {
    return (
      <span className="text-xs text-muted">
        PIN 잠금 사용 중 — <code className="rounded bg-surface-2 px-1">.env.local</code>에{" "}
        <code className="rounded bg-surface-2 px-1">SPM_CAPTURE_TOKEN</code>을 설정하면 북마클릿을
        쓸 수 있습니다
      </span>
    );
  }

  const params = token ? `token=${encodeURIComponent(token)}&` : "";
  const href = `javascript:void(window.open('${origin}/api/capture?${params}url='+encodeURIComponent(location.href)+'&title='+encodeURIComponent(document.title),'_blank','width=380,height=160'))`;

  return (
    <span className="flex items-center gap-2.5">
      <a
        // React 19는 javascript: href를 차단 문자열로 치환하므로 ref로 직접 지정한다
        ref={(el) => {
          el?.setAttribute("href", href);
        }}
        onClick={(e) => e.preventDefault()}
        className="rounded-md border border-ink px-3 py-1.5 text-xs font-medium"
        title="이 링크를 브라우저 북마크바로 드래그하세요"
      >
        📥 SPM에 저장
      </a>
      <span className="text-xs text-muted">
        ← 이 버튼을 북마크바로 드래그. 아무 페이지에서 누르면 인박스로 캡처됩니다
      </span>
    </span>
  );
}
