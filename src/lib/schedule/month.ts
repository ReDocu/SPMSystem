import { getPool } from "@/lib/db";
import { getUserId } from "@/lib/user";

export interface DayStripe {
  date: string;
  segments: { color: string | null; min: number }[]; // 프로젝트 색 비율 띠 (null = 기타)
}

export interface MonthDue {
  id: string;
  date: string;
  title: string;
  done: boolean;
  isMilestone: boolean;
  color: string | null;
}

export interface MonthAggregate {
  byProject: { title: string; color: string | null; min: number }[];
  doneCount: number;
}

/** 기록 띠 — 날짜별 타임로그를 프로젝트 색 비율로 압축 (셀의 주인공, §5.2). */
export async function monthStripes(fromKey: string, toKey: string): Promise<DayStripe[]> {
  const userId = await getUserId();
  const r = await getPool().query<{ date: string; color: string | null; min: string }>(
    `select l.date::text, p.color, sum(l.end_min - l.start_min) as min
     from time_logs l left join projects p on p.id = l.project_id
     where l.user_id = $1 and l.date between $2 and $3
     group by l.date, p.color order by l.date, min desc`,
    [userId, fromKey, toKey],
  );
  const byDate = new Map<string, DayStripe>();
  for (const row of r.rows) {
    const entry = byDate.get(row.date) ?? { date: row.date, segments: [] };
    entry.segments.push({ color: row.color, min: Number(row.min) });
    byDate.set(row.date, entry);
  }
  return [...byDate.values()];
}

/** 셀 모서리 컨디션 이모지 미니 표시 (USE-08). */
export async function monthConditions(
  fromKey: string,
  toKey: string,
): Promise<{ date: string; condition: number }[]> {
  const userId = await getUserId();
  const r = await getPool().query<{ date: string; condition: number | null }>(
    "select date::text, condition from daily_notes where user_id = $1 and date between $2 and $3",
    [userId, fromKey, toKey],
  );
  return r.rows
    .filter((row): row is { date: string; condition: number } => row.condition !== null)
    .map((row) => ({ date: row.date, condition: row.condition }));
}

/** 마감 태스크 + 마일스톤 레이어 — 표시만, 체크는 일별·소유는 각 영역 (§5.2). */
export async function monthDues(fromKey: string, toKey: string): Promise<MonthDue[]> {
  const userId = await getUserId();
  const pool = getPool();
  const [tasks, milestones] = await Promise.all([
    pool.query<{ id: string; date: string; title: string; done: boolean; color: string | null }>(
      `select t.id, t.due_date::text as date, t.title, t.status = 'done' as done, p.color
       from tasks t left join projects p on p.id = t.project_id
       where t.user_id = $1 and t.due_date between $2 and $3 and t.status <> 'dropped'
       order by t.due_date`,
      [userId, fromKey, toKey],
    ),
    pool.query<{ id: string; date: string; title: string; color: string | null }>(
      `select m.id, m.due_date::text as date, m.title, p.color
       from milestones m join projects p on p.id = m.project_id
       where m.user_id = $1 and m.due_date between $2 and $3
       order by m.due_date`,
      [userId, fromKey, toKey],
    ),
  ]);
  return [
    ...tasks.rows.map((t) => ({ ...t, isMilestone: false })),
    ...milestones.rows.map((m) => ({ ...m, done: false, isMilestone: true })),
  ];
}

/** 사이드 패널 — 프로젝트별 누적 시간 + 이번 달 마감 완료 수 (§5.3). */
export async function monthAggregates(fromKey: string, toKey: string): Promise<MonthAggregate> {
  const userId = await getUserId();
  const pool = getPool();
  const [byProject, done] = await Promise.all([
    pool.query<{ title: string | null; color: string | null; min: string }>(
      `select p.title, p.color, sum(l.end_min - l.start_min) as min
       from time_logs l left join projects p on p.id = l.project_id
       where l.user_id = $1 and l.date between $2 and $3
       group by p.title, p.color order by min desc`,
      [userId, fromKey, toKey],
    ),
    pool.query<{ count: string }>(
      `select count(*) from tasks
       where user_id = $1 and status = 'done'
         and coalesce(due_date, planned_date) between $2 and $3`,
      [userId, fromKey, toKey],
    ),
  ]);
  return {
    byProject: byProject.rows.map((row) => ({
      title: row.title ?? "기타",
      color: row.color,
      min: Number(row.min),
    })),
    doneCount: Number(done.rows[0].count),
  };
}
