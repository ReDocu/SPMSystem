import { addDays, toDateKey } from "@/lib/dates";

export interface SeriesLike {
  startAt: Date;
  endAt: Date;
  rrule: string | null; // "FREQ=DAILY|WEEKLY|MONTHLY|YEARLY" — v0.4 부분집합
  exdates: string[]; // 취소된 회차 (YYYY-MM-DD)
}

export interface Occurrence {
  date: string; // 회차 날짜 (YYYY-MM-DD)
  spanDays: number; // 여러 날 일정(출장)의 전체 길이
  dayIndex: number; // 그 안에서 몇 번째 날인지 (가로 바 렌더용)
}

const FREQ_RE = /FREQ=(DAILY|WEEKLY|MONTHLY|YEARLY)/i;
const MAX_ITERATIONS = 1000;

const dayStart = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

/**
 * 반복 일정 회차 전개 (상세기획 §5.5) — rrule 부분집합.
 * 반복 회차는 시작일과 같은 요일/일/월일로 계산하고, 없는 날짜(2/31)는 건너뛴다.
 * 여러 날 단발 일정은 날짜별 회차로 쪼개 가로 바 재료를 만든다.
 */
export function expandOccurrences(
  series: SeriesLike,
  rangeStart: Date,
  rangeEnd: Date,
): Occurrence[] {
  const freq = series.rrule?.match(FREQ_RE)?.[1]?.toUpperCase() ?? null;
  const from = dayStart(rangeStart);
  const to = dayStart(rangeEnd);
  const excluded = new Set(series.exdates);
  const result: Occurrence[] = [];

  if (!freq) {
    // 단발 — start~end 사이의 날짜별 회차 (하루면 1개)
    const first = dayStart(series.startAt);
    const last = dayStart(series.endAt);
    const spanDays = Math.round((last.getTime() - first.getTime()) / 86_400_000) + 1;
    for (let i = 0; i < spanDays && i < MAX_ITERATIONS; i++) {
      const day = addDays(first, i);
      if (day < from || day > to) continue;
      const key = toDateKey(day);
      if (excluded.has(key)) continue;
      result.push({ date: key, spanDays, dayIndex: i });
    }
    return result;
  }

  const start = dayStart(series.startAt);
  if (to < start) return [];

  const pushIfValid = (day: Date) => {
    if (day < start || day < from || day > to) return;
    const key = toDateKey(day);
    if (excluded.has(key)) return;
    result.push({ date: key, spanDays: 1, dayIndex: 0 });
  };

  if (freq === "DAILY" || freq === "WEEKLY") {
    const step = freq === "DAILY" ? 1 : 7;
    // 범위 시작 이후 첫 회차로 점프
    const diffDays = Math.max(0, Math.floor((from.getTime() - start.getTime()) / 86_400_000));
    let day = addDays(start, Math.floor(diffDays / step) * step);
    for (let i = 0; i < MAX_ITERATIONS && day <= to; i++) {
      pushIfValid(day);
      day = addDays(day, step);
    }
    return result;
  }

  if (freq === "MONTHLY") {
    const wantedDay = series.startAt.getDate();
    let year = from.getFullYear();
    let month = from.getMonth();
    for (let i = 0; i < MAX_ITERATIONS; i++) {
      const day = new Date(year, month, wantedDay);
      if (day > to) break;
      // 롤오버(2/31 → 3월)는 그 달에 없는 날짜 — 건너뛴다
      if (day.getDate() === wantedDay) pushIfValid(day);
      month += 1;
      if (month > 11) {
        month = 0;
        year += 1;
      }
    }
    return result;
  }

  // YEARLY
  const wantedMonth = series.startAt.getMonth();
  const wantedDate = series.startAt.getDate();
  for (let year = from.getFullYear(); year <= to.getFullYear(); year++) {
    const day = new Date(year, wantedMonth, wantedDate);
    if (day.getDate() === wantedDate && day.getMonth() === wantedMonth) pushIfValid(day);
  }
  return result;
}
