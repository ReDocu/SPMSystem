import Link from "next/link";
import { notFound } from "next/navigation";
import { addDays, formatKoreanDate, toDateKey } from "@/lib/dates";

const HOURS = Array.from({ length: 12 }, (_, i) => i + 6); // 06–17시, 00–06은 접힘

// 일별 기록지 — 매일 여는 기본 화면 (화면명세서 §4-1). v0.1: 타임로그 + 오늘 할 일 + 백로그 + 데일리 노트
export default async function DayPage({ params }: { params: Promise<{ date: string }> }) {
  const { date } = await params;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) notFound();
  const day = new Date(date);
  if (Number.isNaN(day.getTime())) notFound();

  return (
    <div className="flex h-full flex-col gap-4">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Link
            href={`/schedule/day/${toDateKey(addDays(day, -1))}`}
            className="rounded-md border border-line px-2 py-1 text-xs"
          >
            ◀
          </Link>
          <h1 className="text-base font-bold">{formatKoreanDate(day)}</h1>
          <Link
            href={`/schedule/day/${toDateKey(addDays(day, 1))}`}
            className="rounded-md border border-line px-2 py-1 text-xs"
          >
            ▶
          </Link>
          <Link
            href={`/schedule/day/${toDateKey(new Date())}`}
            className="rounded-md border border-line px-3 py-1 text-xs"
          >
            오늘
          </Link>
        </div>
        <div className="flex gap-0.5 rounded-lg border border-line bg-surface p-0.5 text-xs">
          <span className="rounded-md bg-ink px-3 py-1 font-medium text-surface">일별</span>
          <span className="px-3 py-1 text-muted">달별 v0.4</span>
          <span className="px-3 py-1 text-muted">연별 v0.3</span>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 gap-5">
        <section className="min-w-0 flex-1">
          <div className="mb-2 rounded-md border border-dashed border-line px-3 py-1.5 text-xs text-muted">
            ▸ 00–06 (접힘)
          </div>
          <div>
            {HOURS.map((h) => (
              <div key={h} className="flex h-10 items-start gap-2.5">
                <span className="w-6 text-right font-mono text-xs text-muted">
                  {String(h).padStart(2, "0")}
                </span>
                <div className="h-px flex-1 translate-y-2 bg-line" />
              </div>
            ))}
          </div>
        </section>

        <aside className="flex w-80 flex-none flex-col gap-2.5">
          <section className="rounded-lg border border-line bg-surface p-3.5">
            <h2 className="mb-2 text-[13px] font-bold">오늘 할 일</h2>
            <p className="text-xs text-muted">아직 없음 — ⌘K로 던져두세요</p>
          </section>
          <div className="rounded-lg border border-dashed border-line px-3.5 py-2 text-[13px] text-muted">
            ▸ 못 한 일 (0)
          </div>
          <div className="rounded-lg border border-dashed border-line px-3.5 py-2 text-[13px] text-muted">
            ▸ 백로그 (0)
          </div>
          <section className="rounded-lg border border-line bg-surface p-3.5">
            <h2 className="mb-2 text-[13px] font-bold">데일리 노트</h2>
            <div className="h-8 rounded-md border border-dashed border-line" />
          </section>
        </aside>
      </div>

      <footer className="border-t border-line pt-3 text-[13px] text-muted">
        기록 0h — 빈 칸을 눌러 기록해보세요
      </footer>
    </div>
  );
}
