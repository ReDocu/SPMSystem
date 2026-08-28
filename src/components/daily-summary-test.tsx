"use client";

import { useState } from "react";

// 설정 › 알림 [테스트 발송] — 일일 요약을 즉시 만들어 미리보기/발송한다.
// 토큰은 북마클릿과 같은 자동화 토큰 (1인 로컬 도구 — 설정 페이지 노출은 의도된 설계)
export function DailySummaryTest({
  webhookConfigured,
  token,
}: {
  webhookConfigured: boolean;
  token: string | null;
}) {
  const [preview, setPreview] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "busy" | "error">("idle");
  const [sent, setSent] = useState(false);

  const run = async () => {
    setStatus("busy");
    const query = token ? `?token=${encodeURIComponent(token)}` : "";
    const res = await fetch(`/api/cron/daily${query}`, { method: "POST" }).catch(() => null);
    if (!res?.ok) {
      setStatus("error");
      return;
    }
    const data = (await res.json()) as { sent: boolean; preview: string };
    setPreview(data.preview);
    setSent(data.sent);
    setStatus("idle");
  };

  return (
    <span className="flex min-w-0 flex-1 flex-col gap-1.5">
      <span className="flex items-center gap-2.5">
        <button
          onClick={run}
          disabled={status === "busy"}
          className="rounded-md border border-ink px-3 py-1.5 text-xs font-medium hover:bg-surface-2"
        >
          테스트 발송
        </button>
        <span className="text-xs text-muted">
          {webhookConfigured
            ? "SPM_DISCORD_WEBHOOK으로 발송됩니다"
            : ".env.local에 SPM_DISCORD_WEBHOOK을 설정하면 Discord로 발송됩니다 (지금은 미리보기만)"}
        </span>
        {status === "error" && <span className="text-xs text-muted">실패 — 다시 시도해주세요</span>}
      </span>
      {preview && (
        <span className="flex flex-col gap-1">
          <span className="text-[11px] text-muted">{sent ? "발송됨 ✓ — 보낸 내용:" : "미리보기:"}</span>
          <pre className="max-w-xl overflow-x-auto whitespace-pre-wrap rounded-md border border-line bg-surface-2/60 px-3 py-2 text-[11px] leading-relaxed">
            {preview}
          </pre>
        </span>
      )}
    </span>
  );
}
