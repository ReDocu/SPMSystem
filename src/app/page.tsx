import Link from "next/link";
import { formatKoreanDate } from "@/lib/dates";

const TILES = [
  { href: "/schedule", title: "일정", main: "오늘 남은 —", sub: "기록을 시작해보세요" },
  { href: "/projects", title: "프로젝트", main: "v0.3 예정", sub: "", disabled: true },
  { href: "/ops", title: "운영·배포", main: "v0.5 예정", sub: "", disabled: true },
  { href: "/resources", title: "자료수집", main: "v0.2 예정", sub: "", disabled: true },
];

// 메인 런처 — 사이드바 없음(관문 역할). 데이터는 GET /api/summary 1회 (v0.1은 스텁)
export default function LauncherPage() {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-10 py-12">
      <header className="flex items-center justify-between">
        <h1 className="text-xl font-bold tracking-widest">SPM</h1>
        <span className="text-sm text-muted">{formatKoreanDate(new Date())}</span>
      </header>

      <div className="grid flex-1 grid-cols-1 gap-5 sm:grid-cols-2">
        {TILES.map((tile) =>
          tile.disabled ? (
            <div
              key={tile.title}
              className="flex flex-col gap-2 rounded-xl border border-dashed border-line bg-surface p-6 opacity-60"
            >
              <span className="text-sm font-medium">{tile.title}</span>
              <span className="text-sm text-muted">{tile.main}</span>
            </div>
          ) : (
            <Link
              key={tile.title}
              href={tile.href}
              className="flex flex-col gap-2 rounded-xl border border-line bg-surface p-6 transition-colors hover:border-primary"
            >
              <span className="text-sm font-medium">{tile.title}</span>
              <span className="text-2xl font-bold">{tile.main}</span>
              <span className="text-sm text-muted">{tile.sub}</span>
            </Link>
          ),
        )}
      </div>

      <Link
        href="/inbox"
        className="flex items-center justify-between rounded-xl border border-dashed border-line bg-surface px-5 py-4 text-sm text-muted hover:text-ink"
      >
        <span>&gt; 빠른 입력 — 무엇이든 던져두세요</span>
        <span className="rounded-full border border-line px-2 py-0.5 text-[11px]">⌘K</span>
      </Link>
    </div>
  );
}
