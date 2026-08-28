import { getPool } from "@/lib/db";
import { getUserId } from "@/lib/user";
import { findProjectIdByTag, recomputeProgress } from "@/lib/projects/repo";

export type TaskStatus = "todo" | "doing" | "done" | "dropped";

export interface TimeLog {
  id: string;
  date: string;
  startMin: number;
  endMin: number;
  content: string;
}

export interface Task {
  id: string;
  title: string;
  status: string;
  dueDate: string | null;
  plannedDate: string | null;
  projectId: string | null;
  projectTitle?: string | null; // 백로그의 프로젝트 배지용 (조인 시에만 채움)
}

export interface DailyNote {
  content: string | null;
  condition: number | null;
}

const LOG_FIELDS = "id, date::text, start_min, end_min, content";
const TASK_FIELDS = "id, title, status, due_date::text, planned_date::text, project_id";

interface LogRow {
  id: string;
  date: string;
  start_min: number;
  end_min: number;
  content: string;
}

interface TaskRow {
  id: string;
  title: string;
  status: string;
  due_date: string | null;
  planned_date: string | null;
  project_id: string | null;
  project_title?: string | null;
}

const toLog = (r: LogRow): TimeLog => ({
  id: r.id,
  date: r.date,
  startMin: r.start_min,
  endMin: r.end_min,
  content: r.content,
});

const toTask = (r: TaskRow): Task => ({
  id: r.id,
  title: r.title,
  status: r.status,
  dueDate: r.due_date,
  plannedDate: r.planned_date,
  projectId: r.project_id,
  ...(r.project_title !== undefined && { projectTitle: r.project_title }),
});

const TAG_RE = /#([\p{L}\p{N}_-]+)/u;

// ---------- 타임로그 ----------

export async function listLogs(date: string): Promise<TimeLog[]> {
  const userId = await getUserId();
  const r = await getPool().query<LogRow>(
    `select ${LOG_FIELDS} from time_logs where user_id = $1 and date = $2 order by start_min`,
    [userId, date],
  );
  return r.rows.map(toLog);
}

export async function createLog(
  date: string,
  startMin: number,
  endMin: number,
  content: string,
): Promise<TimeLog> {
  const userId = await getUserId();
  // `#프로젝트명`이 프로젝트 제목과 일치하면 자동 연결 → 투입 시간 집계 재료 (상세기획 §4.3)
  const tag = content.match(TAG_RE)?.[1];
  const projectId = tag ? await findProjectIdByTag(tag) : null;
  const r = await getPool().query<LogRow>(
    `insert into time_logs (user_id, date, start_min, end_min, content, project_id)
     values ($1, $2, $3, $4, $5, $6) returning ${LOG_FIELDS}`,
    [userId, date, startMin, endMin, content, projectId],
  );
  return toLog(r.rows[0]);
}

/** 병합 블록 이름 변경 — 부분 실패로 블록이 쪼개지지 않게 단일 문장으로 갱신한다. */
export async function updateLogsContent(ids: string[], content: string): Promise<number> {
  if (ids.length === 0) return 0;
  const userId = await getUserId();
  const r = await getPool().query(
    "update time_logs set content = $3 where user_id = $1 and id = any($2::uuid[])",
    [userId, ids, content],
  );
  return r.rowCount ?? 0;
}

export async function deleteLogs(ids: string[]): Promise<number> {
  if (ids.length === 0) return 0;
  const userId = await getUserId();
  const r = await getPool().query(
    "delete from time_logs where user_id = $1 and id = any($2::uuid[])",
    [userId, ids],
  );
  return r.rowCount ?? 0;
}

// ---------- 태스크 (오늘 할 일 · 못 한 일 · 백로그) ----------

export async function listPlannedTasks(date: string): Promise<Task[]> {
  const userId = await getUserId();
  const r = await getPool().query<TaskRow>(
    `select ${TASK_FIELDS} from tasks
     where user_id = $1 and planned_date = $2 and status <> 'dropped'
     order by status = 'done', created_at`,
    [userId, date],
  );
  return r.rows.map(toTask);
}

/**
 * 7일 지난 못 한 일을 백로그로 자동 반환한다 (상세기획 §4.5 ISSUE-07).
 * - 오늘 기록지를 열 때만 호출 (과거 날짜 열람·프리페치가 쓰기를 유발하면 안 된다)
 * - 마감·연간 목표가 있는 태스크는 planned_date를 지워도 백로그에 못 들어가
 *   어떤 목록에도 안 보이는 고아가 되므로 제외한다
 */
export async function sweepMissedToBacklog(today: string): Promise<number> {
  const userId = await getUserId();
  const r = await getPool().query(
    `update tasks set planned_date = null
     where user_id = $1 and status not in ('done', 'dropped')
       and planned_date < $2::date - interval '7 days'
       and due_date is null and target_year is null`,
    [userId, today],
  );
  return r.rowCount ?? 0;
}

/** 못 한 일 — planned_date가 지난 미완료 누적 (오늘 기준). */
export async function listMissedTasks(today: string): Promise<Task[]> {
  const userId = await getUserId();
  const r = await getPool().query<TaskRow>(
    `select ${TASK_FIELDS} from tasks
     where user_id = $1 and status not in ('done', 'dropped') and planned_date < $2
     order by planned_date desc`,
    [userId, today],
  );
  return r.rows.map(toTask);
}

/** 백로그 — 마감·계획일·연간 목표가 모두 없는 미완료. 프로젝트 태스크는 배지로 구분 (§4.5). */
export async function listBacklog(): Promise<Task[]> {
  const userId = await getUserId();
  const r = await getPool().query<TaskRow>(
    `select t.id, t.title, t.status, t.due_date::text, t.planned_date::text, t.project_id,
       p.title as project_title
     from tasks t left join projects p on p.id = t.project_id
     where t.user_id = $1 and t.status = 'todo'
       and t.planned_date is null and t.due_date is null and t.target_year is null
     order by t.created_at desc`,
    [userId],
  );
  return r.rows.map(toTask);
}

export async function createTask(title: string, plannedDate: string | null): Promise<Task> {
  const userId = await getUserId();
  const r = await getPool().query<TaskRow>(
    `insert into tasks (user_id, title, planned_date) values ($1, $2, $3)
     returning ${TASK_FIELDS}`,
    [userId, title, plannedDate],
  );
  return toTask(r.rows[0]);
}

export async function setTaskStatus(id: string, status: TaskStatus): Promise<Task | null> {
  const userId = await getUserId();
  const r = await getPool().query<TaskRow>(
    `update tasks set status = $3 where id = $1 and user_id = $2 returning ${TASK_FIELDS}`,
    [id, userId, status],
  );
  if (r.rows.length === 0) return null;
  const task = toTask(r.rows[0]);
  // 진행률 캐시는 best-effort — 재계산 실패가 이미 커밋된 상태 변경을 500으로 만들면 안 된다
  if (task.projectId) {
    await recomputeProgress(task.projectId).catch((error) =>
      console.error("진행률 재계산 실패:", error),
    );
  }
  return task;
}

/** 오늘로 재선정(날짜) 또는 백로그 반환(null). */
export async function setTaskPlannedDate(
  id: string,
  plannedDate: string | null,
): Promise<Task | null> {
  const userId = await getUserId();
  const r = await getPool().query<TaskRow>(
    `update tasks set planned_date = $3 where id = $1 and user_id = $2 returning ${TASK_FIELDS}`,
    [id, userId, plannedDate],
  );
  return r.rows.length > 0 ? toTask(r.rows[0]) : null;
}

// ---------- 연별 TO DO (화면명세서 §4-3) ----------

/** 올해 하고 싶은 일 — target_year 태스크. done·dropped도 취소선으로 잔존. */
export async function listYearTasks(year: number): Promise<Task[]> {
  const userId = await getUserId();
  const r = await getPool().query<TaskRow>(
    `select t.id, t.title, t.status, t.due_date::text, t.planned_date::text, t.project_id,
       p.title as project_title
     from tasks t left join projects p on p.id = t.project_id
     where t.user_id = $1 and t.target_year = $2
     order by t.status in ('done','dropped'), t.created_at`,
    [userId, year],
  );
  return r.rows.map(toTask);
}

export async function createYearTask(title: string, year: number): Promise<Task> {
  const userId = await getUserId();
  const r = await getPool().query<TaskRow>(
    `insert into tasks (user_id, title, target_year) values ($1, $2, $3)
     returning ${TASK_FIELDS}`,
    [userId, title, year],
  );
  return toTask(r.rows[0]);
}

/** 연별 항목 [프로젝트로 만들기] → idea 프로젝트 생성 + 원본 연결 (USE-05). */
export async function promoteYearTask(taskId: string): Promise<{ projectId: string } | null> {
  const userId = await getUserId();
  const found = await getPool().query<{ title: string }>(
    "select title from tasks where id = $1 and user_id = $2 and target_year is not null",
    [taskId, userId],
  );
  if (found.rows.length === 0) return null;
  const { createProject } = await import("@/lib/projects/repo");
  const project = await createProject(found.rows[0].title, "연간 목표에서 승격");
  await getPool().query("update tasks set project_id = $3 where id = $1 and user_id = $2", [
    taskId,
    userId,
    project.id,
  ]);
  return { projectId: project.id };
}

// ---------- 데일리 노트 ----------

export async function getDailyNote(date: string): Promise<DailyNote> {
  const userId = await getUserId();
  const r = await getPool().query<{ content: string | null; condition: number | null }>(
    "select content, condition from daily_notes where user_id = $1 and date = $2",
    [userId, date],
  );
  return r.rows[0] ?? { content: null, condition: null };
}

export async function upsertDailyNote(
  date: string,
  patch: { content?: string | null; condition?: number | null },
): Promise<DailyNote> {
  const userId = await getUserId();
  const r = await getPool().query<{ content: string | null; condition: number | null }>(
    `insert into daily_notes (user_id, date, content, condition)
     values ($1, $2, $3, $4)
     on conflict (user_id, date) do update set
       content = case when $5 then excluded.content else daily_notes.content end,
       condition = case when $6 then excluded.condition else daily_notes.condition end
     returning content, condition`,
    [
      userId,
      date,
      patch.content ?? null,
      patch.condition ?? null,
      patch.content !== undefined,
      patch.condition !== undefined,
    ],
  );
  return r.rows[0];
}
