import Link from "next/link";
import { notFound } from "next/navigation";
import { isDbConfigured } from "@/lib/db";
import { listYearTasks } from "@/lib/schedule/repo";
import { listOccurrences, type EventOccurrence } from "@/lib/schedule/events";
import { toDateKey } from "@/lib/dates";
import { YearList } from "@/components/year-list";
import { Anniversaries } from "@/components/anniversaries";

export const dynamic = "force-dynamic";

// 연별 목표 — 올해 하고 싶은 일 (화면명세서 §4-3). 기념일 패널은 event 소유라 v0.4
export default async function YearPage({ params }: { params: Promise<{ year: string }> }) {
  const { year: rawYear } = await params;
  if (!/^\d{4}$/.test(rawYear)) notFound();
  const year = Number(rawYear);
  const currentYear = new Date().getFullYear();
  const isReadOnly = year < currentYear; // 지난 연도는 읽기 전용 아카이브

  const tasks = isDbConfigured() ? await listYearTasks(year).catch(() => []) : [];
  const done = tasks.filter((t) => t.status === "done").length;
  const total = tasks.filter((t) => t.status !== "dropped").length;
  const anniversaries: EventOccurrence[] = isDbConfigured()
    ? (await listOccurrences(`${year}-01-01`, `${year}-12-31`).catch(() => [])).filter(
        (o) => o.event.category === "기념일",
      )
    : [];
  const today = toDateKey(new Date());

  return (
    <div className="flex max-w-2xl flex-col gap-4">
      <header className="flex items-center gap-2">
        <Link
          href={`/schedule/year/${year - 1}`}
          className="rounded-md border border-line px-2 py-1 text-xs"
        >
          ◀
        </Link>
        <h1 className="text-base font-bold">{year}년</h1>
        <Link
          href={`/schedule/year/${year + 1}`}
          className="rounded-md border border-line px-2 py-1 text-xs"
        >
          ▶
        </Link>
        <span className="flex-1" />
        {/* 진행률 바 없음 — n/m 완료만 (압박 방지) */}
        <span className="text-xs text-muted">
          {done}/{total} 완료
        </span>
        <div className="flex gap-0.5 rounded-lg border border-line bg-surface p-0.5 text-xs">
          <Link href={`/schedule/day/${toDateKey(new Date())}`} className="px-3 py-1 text-muted hover:text-ink">
            일별
          </Link>
          <span className="px-3 py-1 text-muted">달별 v0.4</span>
          <span className="rounded-md bg-ink px-3 py-1 font-medium text-surface">연별</span>
        </div>
      </header>

      <YearList year={year} tasks={tasks} readOnly={isReadOnly} />

      <Anniversaries occurrences={anniversaries} today={today} />
    </div>
  );
}
