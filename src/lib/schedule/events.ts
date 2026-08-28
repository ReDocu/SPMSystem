import { getPool } from "@/lib/db";
import { getUserId } from "@/lib/user";
import { toDateKey } from "@/lib/dates";
import { expandOccurrences } from "@/lib/schedule/recur";
import type { EventCategory, EventOccurrence, ScheduleEvent } from "@/lib/schedule/event-model";

export type { EventOccurrence, ScheduleEvent };

interface EventRow {
  id: string;
  title: string;
  category: EventCategory;
  all_day: boolean;
  rrule: string | null;
  exdates: string[];
  start_at: Date;
  end_at: Date;
}

// exdates는 ::text[]로 받아야 'YYYY-MM-DD' 문자열로 온다 — Date 객체로 오면
// recur의 문자열 비교가 절대 일치하지 않아 회차 취소가 조용히 무시된다
const FIELDS = "id, title, category, all_day, rrule, exdates::text[] as exdates, start_at, end_at";

// 서버(Node)는 로컬 KST로 돌므로 Date의 로컬 필드가 곧 사용자 시각이다
const minutesOf = (d: Date) => d.getHours() * 60 + d.getMinutes();

const toEvent = (r: EventRow): ScheduleEvent => ({
  id: r.id,
  title: r.title,
  category: r.category,
  allDay: r.all_day,
  rrule: r.rrule,
  exdates: r.exdates ?? [],
  startDate: toDateKey(r.start_at),
  endDate: toDateKey(r.end_at),
  startMin: r.all_day ? 0 : minutesOf(r.start_at),
  endMin: r.all_day ? 24 * 60 : minutesOf(r.end_at),
});

function toTimestamps(input: {
  date: string;
  endDate?: string | null;
  startMin?: number | null;
  endMin?: number | null;
  allDay: boolean;
}): { startAt: Date; endAt: Date } {
  const [y, m, d] = input.date.split("-").map(Number);
  const [ey, em, ed] = (input.endDate ?? input.date).split("-").map(Number);
  if (input.allDay) {
    return { startAt: new Date(y, m - 1, d), endAt: new Date(ey, em - 1, ed, 23, 59) };
  }
  const startMin = input.startMin ?? 0;
  const endMin = input.endMin ?? startMin + 60;
  return {
    startAt: new Date(y, m - 1, d, Math.floor(startMin / 60), startMin % 60),
    endAt: new Date(ey, em - 1, ed, Math.floor(endMin / 60), endMin % 60),
  };
}

/** 범위와 겹칠 수 있는 시리즈를 모두 가져와 회차로 전개한다 (반복은 상한 없이 계속되므로 rrule은 전부). */
export async function listOccurrences(fromKey: string, toKey: string): Promise<EventOccurrence[]> {
  const userId = await getUserId();
  // 경계 비교는 KST 벽시계 날짜로 — UTC date 승격과 비교하면 아침 일정이 전날로 빠진다
  const r = await getPool().query<EventRow>(
    `select ${FIELDS} from schedules
     where user_id = $1
       and (rrule is not null or (end_at at time zone 'Asia/Seoul')::date >= $2::date)
       and (rrule is not null or (start_at at time zone 'Asia/Seoul')::date <= $3::date)
     order by all_day desc, start_at`,
    [userId, fromKey, toKey],
  );
  const [fy, fm, fd] = fromKey.split("-").map(Number);
  const [ty, tm, td] = toKey.split("-").map(Number);
  const rangeStart = new Date(fy, fm - 1, fd);
  const rangeEnd = new Date(ty, tm - 1, td);

  const occurrences: EventOccurrence[] = [];
  for (const row of r.rows) {
    const event = toEvent(row);
    for (const occ of expandOccurrences(
      { startAt: row.start_at, endAt: row.end_at, rrule: row.rrule, exdates: row.exdates ?? [] },
      rangeStart,
      rangeEnd,
    )) {
      occurrences.push({ event, ...occ });
    }
  }
  return occurrences.sort(
    (a, b) => a.date.localeCompare(b.date) || a.event.startMin - b.event.startMin,
  );
}

export interface EventInput {
  title: string;
  date: string;
  endDate?: string | null;
  startMin?: number | null;
  endMin?: number | null;
  allDay: boolean;
  category: EventCategory;
  rrule?: string | null;
}

export async function createEvent(input: EventInput): Promise<ScheduleEvent> {
  const userId = await getUserId();
  const { startAt, endAt } = toTimestamps(input);
  const r = await getPool().query<EventRow>(
    `insert into schedules (user_id, title, category, all_day, rrule, start_at, end_at)
     values ($1, $2, $3, $4, $5, $6, $7) returning ${FIELDS}`,
    [userId, input.title, input.category, input.allDay, input.rrule || null, startAt, endAt],
  );
  return toEvent(r.rows[0]);
}

/** 시리즈 수정 — 기준 날짜나 반복 규칙이 실제로 바뀔 때만 exdates를 초기화한다 (제목 수정이 취소 회차를 되살리면 안 된다). */
export async function updateEvent(id: string, input: EventInput): Promise<ScheduleEvent | null> {
  const userId = await getUserId();
  const { startAt, endAt } = toTimestamps(input);
  const r = await getPool().query<EventRow>(
    `update schedules set title = $3, category = $4, all_day = $5, rrule = $6,
       start_at = $7, end_at = $8,
       exdates = case
         when (start_at at time zone 'Asia/Seoul')::date
                is distinct from ($7 at time zone 'Asia/Seoul')::date
              or rrule is distinct from $6
         then '{}'::date[] else exdates end
     where id = $1 and user_id = $2 returning ${FIELDS}`,
    [id, userId, input.title, input.category, input.allDay, input.rrule || null, startAt, endAt],
  );
  return r.rows.length > 0 ? toEvent(r.rows[0]) : null;
}

/** 회차 취소 (EXDATE) — "이번 주 수업 휴강" (상세기획 §5.5). */
export async function addExdate(id: string, date: string): Promise<boolean> {
  const userId = await getUserId();
  const r = await getPool().query(
    `update schedules set exdates = array_append(exdates, $3::date)
     where id = $1 and user_id = $2 and not ($3::date = any(exdates))`,
    [id, userId, date],
  );
  return (r.rowCount ?? 0) > 0;
}

/** 회차 취소 되돌리기 — 취소의 5초 undo 경로. */
export async function removeExdate(id: string, date: string): Promise<boolean> {
  const userId = await getUserId();
  const r = await getPool().query(
    `update schedules set exdates = array_remove(exdates, $3::date)
     where id = $1 and user_id = $2 and $3::date = any(exdates)`,
    [id, userId, date],
  );
  return (r.rowCount ?? 0) > 0;
}

/** "이 회차만 변경" — 회차 취소 + 단발 생성을 한 트랜잭션으로 (중간 실패 시 회차 유실 방지). */
export async function editOccurrence(
  id: string,
  occurrenceDate: string,
  input: EventInput,
): Promise<ScheduleEvent | null> {
  const userId = await getUserId();
  const { startAt, endAt } = toTimestamps({ ...input, endDate: null });
  const client = await getPool().connect();
  try {
    await client.query("begin");
    const marked = await client.query(
      `update schedules set exdates = array_append(exdates, $3::date)
       where id = $1 and user_id = $2 and not ($3::date = any(exdates))`,
      [id, userId, occurrenceDate],
    );
    if (marked.rowCount === 0) {
      await client.query("rollback");
      return null;
    }
    const r = await client.query<EventRow>(
      `insert into schedules (user_id, title, category, all_day, start_at, end_at)
       values ($1, $2, $3, $4, $5, $6) returning ${FIELDS}`,
      [userId, input.title, input.category, input.allDay, startAt, endAt],
    );
    await client.query("commit");
    return toEvent(r.rows[0]);
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

export async function deleteEvent(id: string): Promise<ScheduleEvent | null> {
  const userId = await getUserId();
  const r = await getPool().query<EventRow>(
    `delete from schedules where id = $1 and user_id = $2 returning ${FIELDS}`,
    [id, userId],
  );
  return r.rows.length > 0 ? toEvent(r.rows[0]) : null;
}

/** 5초 되돌리기 — 삭제 응답의 이벤트를 그대로 복원 (exdates 포함). */
export async function restoreEvent(event: ScheduleEvent): Promise<void> {
  const userId = await getUserId();
  const { startAt, endAt } = toTimestamps({
    date: event.startDate,
    endDate: event.endDate,
    startMin: event.startMin,
    endMin: event.endMin,
    allDay: event.allDay,
  });
  await getPool().query(
    `insert into schedules (id, user_id, title, category, all_day, rrule, exdates, start_at, end_at)
     values ($1, $2, $3, $4, $5, $6, $7::date[], $8, $9)
     on conflict (id) do nothing`,
    [event.id, userId, event.title, event.category, event.allDay, event.rrule, event.exdates, startAt, endAt],
  );
}
