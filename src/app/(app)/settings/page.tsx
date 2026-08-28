// 설정 — JSON export는 v0.1부터 필수 (기획서 §8.2-4: 탈출 가능 원칙 + 무료 플랜 백업 부재 대응)
export default function SettingsPage() {
  const rows = [
    { label: "계정", control: "Supabase 연결 후 활성화" },
    { label: "테마", control: "시스템 / 라이트 / 다크" },
    { label: "알림", control: "Discord Webhook URL" },
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
      <div className="flex items-center gap-4 py-4 text-sm">
        <span className="w-28 flex-none font-bold">백업</span>
        <a
          href="/api/export"
          className="rounded-md border border-ink px-3 py-1.5 text-xs font-medium"
        >
          JSON 전체 내보내기
        </a>
        <span className="text-xs text-muted">DB 텍스트 전체 · Storage 파일 제외</span>
      </div>
    </div>
  );
}
