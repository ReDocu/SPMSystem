import Link from "next/link";
import { notFound } from "next/navigation";
import { isDbConfigured } from "@/lib/db";
import { addDays, toDateKey } from "@/lib/dates";
import { listOccurrences, type EventOccurrence } from "@/lib/schedule/events";
import {
  monthAggregates,
  monthConditions,
  monthDues,
  monthStripes,
  type DayStripe,
  type MonthAggregate,
  type MonthDue,
} from "@/lib/schedule/month";
import { MonthGrid } from "@/components/month/month-grid";
import { formatGuessDate } from "@/lib/capture/format";

export const dynamic = "force-dynamic";

const hours = (min: number) => (Number.isInteger(min / 60) ? `${min / 60}h` : `${(min / 60).toFixed(1)}h`);

function monthGridDays(year: number, month: number): { date: string; inMonth: boolean }[] {
  const first = new Date(year, month - 1, 1);
  const mondayOffset = (first.getDay() + 6) % 7; // 주 시작 월요일 (§5.2)
  const gridStart = addDays(first, -mondayOffset);
  const days: { date: string; inMonth: boolean }[] = [];
  for (let i = 0; i < 42; i++) {
    const day = addDays(gridStart, i);
    days.push({ date: toDateKey(day), inMonth: day.getMonth() === month - 1 });
    // 마지막 주가 다음 달로만 채워지면 5주로 끝낸다
    if (i === 34 && addDays(gridStart, 35).getMonth() !== month - 1) break;
  }
  return days;
}

// 달별 현황판 — 이번 달 프로젝트가 어떻게 흘러갔는지 (상세기획 §5)
export default async function MonthPage({ params }: { params: Promise<{ month: string }> }) {
  const { month: raw } = await params;
  if (!/^\d{4}-\d{2}$/.test(raw)) notFound();
  const [year, month] = raw.split("-").map(Number);
  if (month < 1 || month > 12) notFound();

  const days = monthGridDays(year, month);
  const fromKey = days[0].date;
  const toKey = days[days.length - 1].date;
  const today = toDateKey(new Date());

  let occurrences: EventOccurrence[] = [];
  let stripes: DayStripe[] = [];
  let conditions: { date: string; condition: number }[] = [];
  let dues: MonthDue[] = [];
  let aggregates: MonthAggregate = { byProject: [], doneCount: 0 };
  if (isDbConfigured()) {
    try {
      [occurrences, stripes, conditions, dues, aggregates] = await Promise.all([
        listOccurrences(fromKey, toKey),
        monthStripes(fromKey, toKey),
        monthConditions(fromKey, toKey),
        monthDues(fromKey, toKey),
        monthAggregates(`${raw}-01`, toDateKey(new Date(year, month, 0))),
      ]);
    } catch (error) {
      console.error("달별 로딩 실패:", error);
    }
  }

  const prev = month === 1 ? `${year - 1}-12` : `${year}-${String(month - 1).padStart(2, "0")}`;
  const next = month === 12 ? `${year + 1}-01` : `${year}-${String(month + 1).padStart(2, "0")}`;
  const remainingDues = dues.filter((d) => !d.done && d.date >= today && d.date.startsWith(raw));

  return (
    <div className="flex h-full flex-col gap-4">
      <header className="flex items-center gap-2">
        <Link href={`/schedule/month/${prev}`} className="rounded-md border border-line px-2 py-1 text-xs">◀</Link>
        <h1 className="text-base font-bold">{year}년 {month}월</h1>
        <Link href={`/schedule/month/${next}`} className="rounded-md border border-line px-2 py-1 text-xs">▶</Link>
        <Link href={`/schedule/month/${today.slice(0, 7)}`} className="rounded-md border border-line px-3 py-1 text-xs">
          오늘
        </Link>
        <span className="flex-1" />
        <div className="flex gap-0.5 rounded-lg border border-line bg-surface p-0.5 text-xs">
          <Link href={`/schedule/day/${today}`} className="px-3 py-1 text-muted hover:text-ink">일별</Link>
          <span className="rounded-md bg-ink px-3 py-1 font-medium text-surface">달별</span>
          <Link href={`/schedule/year/${year}`} className="px-3 py-1 text-muted hover:text-ink">연별</Link>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 gap-5">
        <div className="min-w-0 flex-1">
          {stripes.length === 0 && occurrences.length === 0 && dues.length === 0 && (
            <p className="mb-2 rounded-md border border-dashed border-line px-3 py-1.5 text-xs text-muted">
              이번 달 기록이 없습니다 —{" "}
              <Link href={`/schedule/day/${today}`} className="underline underline-offset-2">
                오늘 기록지
              </Link>
              에서 시작해보세요
            </p>
          )}
          <MonthGrid
            days={days}
            today={today}
            occurrences={occurrences}
            stripes={stripes}
            conditions={conditions}
            dues={dues}
          />
        </div>

        <aside className="flex w-56 flex-none flex-col gap-2.5">
          <section className="rounded-lg border border-line bg-surface p-3.5">
            <h2 className="mb-2 text-[13px] font-bold">{month}월 집계</h2>
            {aggregates.byProject.length === 0 && <p className="text-xs text-muted">기록 없음</p>}
            {aggregates.byProject.map((p) => (
              <p key={p.title} className="flex items-center gap-1.5 text-xs">
                <span className="h-2 w-2 flex-none rounded-full" style={{ backgroundColor: p.color ?? "#999" }} />
                <span className="min-w-0 flex-1 truncate">{p.title}</span>
                <span className="flex-none text-muted">{hours(p.min)}</span>
              </p>
            ))}
            <p className="mt-1.5 text-xs text-muted">완료 태스크 {aggregates.doneCount}</p>
          </section>

          <section className="rounded-lg border border-line bg-surface p-3.5">
            <h2 className="mb-2 text-[13px] font-bold">남은 마감</h2>
            {remainingDues.length === 0 && <p className="text-xs text-muted">없음 ✨</p>}
            {remainingDues.slice(0, 8).map((d) => (
              <p key={d.id} className="flex items-center gap-1.5 text-xs">
                <span className="flex-none text-muted">{formatGuessDate(d.date)}</span>
                <span className="min-w-0 flex-1 truncate">
                  {d.isMilestone ? "◆ " : ""}
                  {d.title}
                </span>
              </p>
            ))}
          </section>
        </aside>
      </div>
    </div>
  );
}
