import Link from "next/link";
import { notFound } from "next/navigation";
import { addDays, formatKoreanDate, toDateKey } from "@/lib/dates";
import { isDbConfigured } from "@/lib/db";
import { formatDaySummary, summarizeDay } from "@/lib/schedule/blocks";
import {
  getDailyNote,
  listBacklog,
  listLogs,
  listMissedTasks,
  listPlannedTasks,
  sweepMissedToBacklog,
  type DailyNote,
  type Task,
  type TimeLog,
} from "@/lib/schedule/repo";
import { Timeline } from "@/components/day/timeline";
import { TaskPanel } from "@/components/day/task-panel";
import { DailyNotePanel } from "@/components/day/daily-note";

interface DayData {
  logs: TimeLog[];
  planned: Task[];
  missed: Task[];
  backlog: Task[];
  note: DailyNote;
}

const EMPTY_DAY: DayData = {
  logs: [],
  planned: [],
  missed: [],
  backlog: [],
  note: { content: null, condition: null },
};

async function loadDay(date: string, today: string): Promise<DayData> {
  if (!isDbConfigured()) return EMPTY_DAY;
  try {
    // 7일 자동 반환은 오늘 기록지를 열 때만 — 과거 열람·프리페치는 쓰기를 유발하면 안 된다
    if (date === today) await sweepMissedToBacklog(today);
    // 못 한 일은 열람일이 아니라 오늘 기준 (과거 날짜를 열어도 목록이 흔들리지 않게)
    const [logs, planned, missed, backlog, note] = await Promise.all([
      listLogs(date),
      listPlannedTasks(date),
      listMissedTasks(today),
      listBacklog(),
      getDailyNote(date),
    ]);
    return { logs, planned, missed, backlog, note };
  } catch (error) {
    console.error("일별 기록지 로딩 실패:", error);
    return EMPTY_DAY;
  }
}

// 일별 기록지 — 매일 여는 기본 화면 (화면명세서 §4-1). 오늘 일정(event) 패널은 v0.4
export default async function DayPage({ params }: { params: Promise<{ date: string }> }) {
  const { date } = await params;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) notFound();
  const day = new Date(date);
  if (Number.isNaN(day.getTime())) notFound();

  const today = toDateKey(new Date());
  const { logs, planned, missed, backlog, note } = await loadDay(date, today);
  const summaryLine = formatDaySummary(summarizeDay(logs));

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
          <Link href={`/schedule/day/${today}`} className="rounded-md border border-line px-3 py-1 text-xs">
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
        <Timeline date={date} logs={logs} isToday={date === today} />
        <aside className="flex w-80 flex-none flex-col gap-2.5">
          <TaskPanel date={date} today={today} planned={planned} missed={missed} backlog={backlog} />
          <DailyNotePanel date={date} note={note} />
        </aside>
      </div>

      <footer className="border-t border-line pt-3 text-[13px] text-muted">{summaryLine}</footer>
    </div>
  );
}
