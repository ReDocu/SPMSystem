// 인박스 — 전역 캡처의 처리함 (화면명세서 §3). v0.1: 캡처 + 목록 골격
export default function InboxPage() {
  return (
    <div className="flex flex-col gap-5">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <h1 className="text-lg font-bold">인박스</h1>
          <span className="rounded-full border border-line bg-surface-2 px-2 text-[11px] text-muted">
            0
          </span>
        </div>
        <button className="rounded-md border border-line bg-surface px-3 py-1.5 text-xs text-muted">
          모두 처리 완료
        </button>
      </header>

      <div className="rounded-xl border border-line bg-surface p-10 text-center text-sm text-muted">
        인박스가 비었습니다 ✨
      </div>
    </div>
  );
}
