import { getPool } from "@/lib/db";
import { getUserId } from "@/lib/user";

export interface WeekBar {
  weekStart: string;
  totalMin: number;
}

export interface StatsData {
  weeks: WeekBar[]; // 최근 8주 기록 시간
  byProject: { title: string; color: string | null; totalMin: number }[];
  doneTotal: number;
  doneThisMonth: number;
  conditions: { condition: number; count: number }[]; // 최근 30일
}

/** 통계 (§12 v0.6) — 일정·프로젝트 영역에서 이월된 집계의 열람처. */
export async function loadStats(): Promise<StatsData> {
  const userId = await getUserId();
  const pool = getPool();
  const [weeks, byProject, tasks, conditions] = await Promise.all([
    pool.query<{ week_start: string; min: string }>(
      `select date_trunc('week', l.date)::date::text as week_start,
         sum(l.end_min - l.start_min) as min
       from time_logs l
       where l.user_id = $1
         and l.date >= (date_trunc('week', now() at time zone 'Asia/Seoul') - interval '49 days')::date
       group by week_start order by week_start`,
      [userId],
    ),
    pool.query<{ title: string | null; color: string | null; min: string }>(
      `select p.title, p.color, sum(l.end_min - l.start_min) as min
       from time_logs l left join projects p on p.id = l.project_id
       where l.user_id = $1 group by p.title, p.color order by min desc limit 10`,
      [userId],
    ),
    pool.query<{ total: string; month: string }>(
      `select count(*) filter (where status = 'done') as total,
         count(*) filter (where status = 'done'
           and coalesce(due_date, planned_date) >= date_trunc('month', now() at time zone 'Asia/Seoul')::date) as month
       from tasks where user_id = $1`,
      [userId],
    ),
    pool.query<{ condition: number; count: string }>(
      `select condition, count(*) from daily_notes
       where user_id = $1 and condition is not null and date >= current_date - 30
       group by condition order by condition desc`,
      [userId],
    ),
  ]);
  return {
    weeks: weeks.rows.map((r) => ({ weekStart: r.week_start, totalMin: Number(r.min) })),
    byProject: byProject.rows.map((r) => ({
      title: r.title ?? "기타",
      color: r.color,
      totalMin: Number(r.min),
    })),
    doneTotal: Number(tasks.rows[0].total),
    doneThisMonth: Number(tasks.rows[0].month),
    conditions: conditions.rows.map((r) => ({ condition: r.condition, count: Number(r.count) })),
  };
}
