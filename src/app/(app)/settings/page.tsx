import { BookmarkletGuide } from "@/components/bookmarklet-guide";
import { DailySummaryTest } from "@/components/daily-summary-test";

// 설정 — JSON export는 v0.1부터 필수 (기획서 §8.2: 탈출 가능 원칙, 백업은 본인 책임)
export default function SettingsPage() {
  const rows = [
    { label: "잠금", control: "PIN — 환경변수 SPM_PIN으로 설정" },
    { label: "테마", control: "시스템 / 라이트 / 다크" },
  ];

  return (
    <div className="flex max-w-2xl flex-col">
      <h1 className="mb-5 text-lg font-bold">설정</h1>
      {rows.map((row) => (
        <div
          key={row.label}
          className="flex items-center gap-4 border-b border-line/50 py-4 text-sm"
        >
          <span className="w-28 flex-none font-bold">{row.label}</span>
          <span className="text-muted">{row.control}</span>
        </div>
      ))}
      <div className="flex items-start gap-4 border-b border-line/50 py-4 text-sm">
        <span className="w-28 flex-none pt-1 font-bold">알림</span>
        <DailySummaryTest
          webhookConfigured={Boolean(process.env.SPM_DISCORD_WEBHOOK)}
          token={process.env.SPM_CAPTURE_TOKEN ?? null}
        />
      </div>
      <div className="flex items-center gap-4 border-b border-line/50 py-4 text-sm">
        <span className="w-28 flex-none font-bold">북마클릿</span>
        <BookmarkletGuide
          token={process.env.SPM_CAPTURE_TOKEN ?? null}
          pinEnabled={Boolean(process.env.SPM_PIN)}
        />
      </div>
      <div className="flex items-center gap-4 py-4 text-sm">
        <span className="w-28 flex-none font-bold">백업</span>
        <a
          href="/api/export"
          className="rounded-md border border-ink px-3 py-1.5 text-xs font-medium"
        >
          JSON 전체 내보내기
        </a>
        <span className="text-xs text-muted">DB 텍스트 전체 · 파일 제외 (pg_dump 병행 권장)</span>
      </div>
    </div>
  );
}
