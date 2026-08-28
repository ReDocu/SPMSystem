import { getPool } from "@/lib/db";
import { getUserId } from "@/lib/user";
import { computeProgress } from "@/lib/projects/progress";
import {
  PROJECT_COLORS,
  TRANSITIONS,
  type KanbanTask,
  type Milestone,
  type Project,
  type ProjectDocument,
  type ProjectStatus,
} from "@/lib/projects/model";

export type { KanbanTask, Milestone, Project, ProjectDocument, ProjectStatus };

const CREATED_ISO = `to_char(created_at at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.US') || 'Z'`;
const PROJECT_FIELDS = `id, title, status, description, purpose, target_user, scope_in, scope_out,
  tech_stack, repo_url, deploy_url, progress, color, ${CREATED_ISO} as created_at`;

interface ProjectRow {
  id: string;
  title: string;
  status: ProjectStatus;
  description: string | null;
  purpose: string | null;
  target_user: string | null;
  scope_in: string | null;
  scope_out: string | null;
  tech_stack: string[] | null;
  repo_url: string | null;
  deploy_url: string | null;
  progress: string | number;
  color: string | null;
  created_at: string;
}

const toProject = (r: ProjectRow): Project => ({
  id: r.id,
  title: r.title,
  status: r.status,
  description: r.description,
  purpose: r.purpose,
  targetUser: r.target_user,
  scopeIn: r.scope_in,
  scopeOut: r.scope_out,
  techStack: r.tech_stack,
  repoUrl: r.repo_url,
  deployUrl: r.deploy_url,
  progress: Math.round(Number(r.progress)),
  color: r.color,
  createdAt: r.created_at,
});

// ---------- 목록 ----------

export interface ProjectCard extends Project {
  lastActivityAt: string | null;
  weekMin: number;
}

/** 목록 카드 — 최근 활동일 + 이번 주 투입 시간(타임로그, KST) (§4). */
export async function listProjectCards(): Promise<ProjectCard[]> {
  const userId = await getUserId();
  const r = await getPool().query<ProjectRow & { last_activity: string | null; week_min: string }>(
    `select ${PROJECT_FIELDS},
       greatest(
         (select max(occurred_at) from project_events e where e.project_id = p.id),
         (select max(t.created_at) from tasks t where t.project_id = p.id),
         (select max(l.created_at) from time_logs l where l.project_id = p.id)
       )::text as last_activity,
       coalesce((select sum(l.end_min - l.start_min) from time_logs l
         where l.project_id = p.id
           and (l.created_at at time zone 'Asia/Seoul')
             >= date_trunc('week', now() at time zone 'Asia/Seoul')), 0) as week_min
     from projects p where user_id = $1
     order by last_activity desc nulls last, created_at desc`,
    [userId],
  );
  return r.rows.map((row) => ({
    ...toProject(row),
    lastActivityAt: row.last_activity,
    weekMin: Number(row.week_min),
  }));
}

// ---------- 생성 · 조회 · 수정 ----------

interface Queryable {
  query: <T extends object = Record<string, unknown>>(
    sql: string,
    params?: unknown[],
  ) => Promise<{ rows: T[]; rowCount: number | null }>;
}

/** 트랜잭션 합류용 — 인박스 전환처럼 다른 쓰기와 원자적으로 묶어야 할 때 client를 넘긴다. */
export async function insertProjectTx(
  client: Queryable,
  userId: string,
  title: string,
  description: string | null,
): Promise<Project> {
  const countR = await client.query<{ count: string }>(
    "select count(*) from projects where user_id = $1",
    [userId],
  );
  const color = PROJECT_COLORS[Number(countR.rows[0].count) % PROJECT_COLORS.length];
  const r = await client.query<ProjectRow>(
    `insert into projects (user_id, title, status, description, color)
     values ($1, $2, 'idea', $3, $4) returning ${PROJECT_FIELDS}`,
    [userId, title, description, color],
  );
  await client.query(
    `insert into project_events (user_id, project_id, type, to_status) values ($1, $2, 'transition', 'idea')`,
    [userId, r.rows[0].id],
  );
  return toProject(r.rows[0]);
}

/** G0 씨앗 — 제목(필수) + 한 줄 메모. 색상은 생성 순서로 자동 배정. */
export async function createProject(title: string, description: string | null): Promise<Project> {
  const userId = await getUserId();
  const client = await getPool().connect();
  try {
    await client.query("begin");
    const project = await insertProjectTx(client, userId, title, description);
    await client.query("commit");
    return project;
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

export async function getProject(id: string): Promise<Project | null> {
  const userId = await getUserId();
  const r = await getPool().query<ProjectRow>(
    `select ${PROJECT_FIELDS} from projects where id = $1 and user_id = $2`,
    [id, userId],
  );
  return r.rows.length > 0 ? toProject(r.rows[0]) : null;
}

export interface ProjectPatch {
  title?: string;
  description?: string | null;
  purpose?: string | null;
  targetUser?: string | null;
  scopeIn?: string | null;
  scopeOut?: string | null;
  techStack?: string[] | null;
  repoUrl?: string | null;
  deployUrl?: string | null;
}

const PATCH_COLUMNS: Record<keyof ProjectPatch, string> = {
  title: "title",
  description: "description",
  purpose: "purpose",
  targetUser: "target_user",
  scopeIn: "scope_in",
  scopeOut: "scope_out",
  techStack: "tech_stack",
  repoUrl: "repo_url",
  deployUrl: "deploy_url",
};

export async function updateProject(id: string, patch: ProjectPatch): Promise<Project | null> {
  const userId = await getUserId();
  const sets: string[] = [];
  const params: unknown[] = [id, userId];
  for (const [key, column] of Object.entries(PATCH_COLUMNS) as [keyof ProjectPatch, string][]) {
    if (patch[key] === undefined) continue;
    params.push(patch[key]);
    sets.push(`${column} = $${params.length}`);
  }
  if (sets.length === 0) return getProject(id);
  const r = await getPool().query<ProjectRow>(
    `update projects set ${sets.join(", ")} where id = $1 and user_id = $2 returning ${PROJECT_FIELDS}`,
    params,
  );
  return r.rows.length > 0 ? toProject(r.rows[0]) : null;
}

// ---------- 상태 전이 (게이트) ----------

/** 전이 + project_events 자동 기록 (§2·§6.4). 게이트 필드는 patch로 같은 트랜잭션에서 저장. */
export async function transitionProject(
  id: string,
  to: ProjectStatus,
  patch: ProjectPatch = {},
): Promise<Project | null | "invalid"> {
  const userId = await getUserId();
  const current = await getProject(id);
  if (!current) return null;
  if (!TRANSITIONS[current.status].includes(to)) return "invalid";

  const client = await getPool().connect();
  try {
    await client.query("begin");
    const sets: string[] = ["status = $3"];
    const params: unknown[] = [id, userId, to];
    for (const [key, column] of Object.entries(PATCH_COLUMNS) as [keyof ProjectPatch, string][]) {
      if (patch[key] === undefined) continue;
      params.push(patch[key]);
      sets.push(`${column} = $${params.length}`);
    }
    if (to === "active" && !["paused"].includes(current.status)) {
      sets.push("started_at = coalesce(started_at, current_date)", "ended_at = null");
    }
    if (to === "completed" || to === "dropped") sets.push("ended_at = current_date");
    const r = await client.query<ProjectRow>(
      `update projects set ${sets.join(", ")} where id = $1 and user_id = $2 returning ${PROJECT_FIELDS}`,
      params,
    );
    await client.query(
      `insert into project_events (user_id, project_id, type, from_status, to_status)
       values ($1, $2, 'transition', $3, $4)`,
      [userId, id, current.status, to],
    );
    await client.query("commit");
    return toProject(r.rows[0]);
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

// ---------- 마일스톤 ----------

interface MilestoneRow {
  id: string;
  project_id: string;
  title: string;
  due_date: string | null;
  weight: number;
}

const MS_FIELDS = "id, project_id, title, due_date::text, weight";

const toMilestone = (r: MilestoneRow): Milestone => ({
  id: r.id,
  projectId: r.project_id,
  title: r.title,
  dueDate: r.due_date,
  weight: r.weight,
});

export async function listMilestones(projectId: string): Promise<Milestone[]> {
  const userId = await getUserId();
  const r = await getPool().query<MilestoneRow>(
    `select ${MS_FIELDS} from milestones where user_id = $1 and project_id = $2
     order by due_date nulls last, created_at`,
    [userId, projectId],
  );
  return r.rows.map(toMilestone);
}

export async function createMilestone(
  projectId: string,
  input: { title: string; dueDate?: string | null; weight?: number },
): Promise<Milestone> {
  const userId = await getUserId();
  const r = await getPool().query<MilestoneRow>(
    `insert into milestones (user_id, project_id, title, due_date, weight)
     values ($1, $2, $3, $4, $5) returning ${MS_FIELDS}`,
    [userId, projectId, input.title, input.dueDate ?? null, input.weight ?? 1],
  );
  await recomputeProgress(projectId);
  return toMilestone(r.rows[0]);
}

/** 즉시 삭제 — FK로 풀린 태스크 연결까지 돌려줘 5초 되돌리기에 쓴다 (공통 규칙 §0.4). */
export async function deleteMilestone(
  id: string,
): Promise<{ milestone: Milestone; taskIds: string[] } | null> {
  const userId = await getUserId();
  const pool = getPool();
  const linked = await pool.query<{ id: string }>(
    "select id from tasks where user_id = $1 and milestone_id = $2",
    [userId, id],
  );
  const r = await pool.query<MilestoneRow>(
    `delete from milestones where id = $1 and user_id = $2 returning ${MS_FIELDS}`,
    [id, userId],
  );
  if (r.rows.length === 0) return null;
  const milestone = toMilestone(r.rows[0]);
  await recomputeProgress(milestone.projectId).catch((error) =>
    console.error("진행률 재계산 실패:", error),
  );
  return { milestone, taskIds: linked.rows.map((row) => row.id) };
}

export async function restoreMilestone(milestone: Milestone, taskIds: string[]): Promise<void> {
  const userId = await getUserId();
  const client = await getPool().connect();
  try {
    await client.query("begin");
    await client.query(
      `insert into milestones (id, user_id, project_id, title, due_date, weight)
       values ($1, $2, $3, $4, $5, $6) on conflict (id) do nothing`,
      [milestone.id, userId, milestone.projectId, milestone.title, milestone.dueDate, milestone.weight],
    );
    if (taskIds.length > 0) {
      await client.query(
        "update tasks set milestone_id = $3 where user_id = $1 and id = any($2::uuid[])",
        [userId, taskIds, milestone.id],
      );
    }
    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
  await recomputeProgress(milestone.projectId).catch((error) =>
    console.error("진행률 재계산 실패:", error),
  );
}

// ---------- 칸반 태스크 ----------

export async function listProjectTasks(projectId: string): Promise<KanbanTask[]> {
  const userId = await getUserId();
  // 연간 목표(target_year)는 개요 탭의 연결 목록이 담당 — 칸반에 이중 표시하지 않는다
  const r = await getPool().query<{
    id: string;
    title: string;
    status: string;
    due_date: string | null;
    planned_date: string | null;
    milestone_id: string | null;
  }>(
    `select id, title, status, due_date::text, planned_date::text, milestone_id
     from tasks where user_id = $1 and project_id = $2 and target_year is null
     order by created_at`,
    [userId, projectId],
  );
  return r.rows.map((row) => ({
    id: row.id,
    title: row.title,
    status: row.status,
    dueDate: row.due_date,
    plannedDate: row.planned_date,
    milestoneId: row.milestone_id,
  }));
}

export async function createProjectTask(
  projectId: string,
  input: { title: string; milestoneId?: string | null; dueDate?: string | null },
): Promise<KanbanTask> {
  const userId = await getUserId();
  const r = await getPool().query<{ id: string }>(
    `insert into tasks (user_id, project_id, title, milestone_id, due_date)
     values ($1, $2, $3, $4, $5) returning id`,
    [userId, projectId, input.title, input.milestoneId ?? null, input.dueDate ?? null],
  );
  await recomputeProgress(projectId);
  return {
    id: r.rows[0].id,
    title: input.title,
    status: "todo",
    dueDate: input.dueDate ?? null,
    plannedDate: null,
    milestoneId: input.milestoneId ?? null,
  };
}

/** 진행률 재계산 → projects.progress 캐싱 (§4). 태스크·마일스톤 변경 후 호출. */
export async function recomputeProgress(projectId: string): Promise<number> {
  const userId = await getUserId();
  const pool = getPool();
  const [ms, tasks] = await Promise.all([
    pool.query<{ id: string; weight: number }>(
      "select id, weight from milestones where user_id = $1 and project_id = $2",
      [userId, projectId],
    ),
    pool.query<{ status: string; milestone_id: string | null }>(
      // 연간 목표는 진행률 분모에서 제외 — 칸반과 동일 기준
      "select status, milestone_id from tasks where user_id = $1 and project_id = $2 and target_year is null",
      [userId, projectId],
    ),
  ]);
  const progress = computeProgress(
    ms.rows,
    tasks.rows.map((t) => ({ status: t.status, milestoneId: t.milestone_id })),
  );
  await pool.query("update projects set progress = $3 where id = $1 and user_id = $2", [
    projectId,
    userId,
    progress,
  ]);
  return progress;
}

// ---------- 문서 ----------

interface DocRow {
  id: string;
  project_id: string;
  title: string;
  content: string | null;
  template_type: string | null;
  updated_at: string;
}

const DOC_FIELDS = `id, project_id, title, content, template_type,
  to_char(updated_at at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.US') || 'Z' as updated_at`;

const toDoc = (r: DocRow): ProjectDocument => ({
  id: r.id,
  projectId: r.project_id,
  title: r.title,
  content: r.content,
  templateType: r.template_type,
  updatedAt: r.updated_at,
});

export async function listDocuments(projectId: string): Promise<ProjectDocument[]> {
  const userId = await getUserId();
  const r = await getPool().query<DocRow>(
    `select ${DOC_FIELDS} from documents where user_id = $1 and project_id = $2
     order by updated_at desc`,
    [userId, projectId],
  );
  return r.rows.map(toDoc);
}

export async function createDocument(
  projectId: string,
  input: { title: string; content: string | null; templateType: string | null },
): Promise<ProjectDocument> {
  const userId = await getUserId();
  const r = await getPool().query<DocRow>(
    `insert into documents (user_id, project_id, title, content, template_type)
     values ($1, $2, $3, $4, $5) returning ${DOC_FIELDS}`,
    [userId, projectId, input.title, input.content, input.templateType],
  );
  return toDoc(r.rows[0]);
}

export async function updateDocument(
  id: string,
  patch: { title?: string; content?: string | null },
): Promise<ProjectDocument | null> {
  const userId = await getUserId();
  const sets: string[] = ["updated_at = now()"];
  const params: unknown[] = [id, userId];
  if (patch.title !== undefined) {
    params.push(patch.title);
    sets.push(`title = $${params.length}`);
  }
  if (patch.content !== undefined) {
    params.push(patch.content);
    sets.push(`content = $${params.length}`);
  }
  const r = await getPool().query<DocRow>(
    `update documents set ${sets.join(", ")} where id = $1 and user_id = $2 returning ${DOC_FIELDS}`,
    params,
  );
  return r.rows.length > 0 ? toDoc(r.rows[0]) : null;
}

/** 즉시 삭제 — 삭제 행을 돌려줘 5초 되돌리기에 쓴다 (공통 규칙 §0.4). */
export async function deleteDocument(id: string): Promise<ProjectDocument | null> {
  const userId = await getUserId();
  const r = await getPool().query<DocRow>(
    `delete from documents where id = $1 and user_id = $2 returning ${DOC_FIELDS}`,
    [id, userId],
  );
  return r.rows.length > 0 ? toDoc(r.rows[0]) : null;
}

export async function restoreDocument(doc: ProjectDocument): Promise<ProjectDocument> {
  const userId = await getUserId();
  const r = await getPool().query<DocRow>(
    `insert into documents (id, user_id, project_id, title, content, template_type, updated_at)
     values ($1, $2, $3, $4, $5, $6, $7::timestamptz)
     on conflict (id) do nothing returning ${DOC_FIELDS}`,
    [doc.id, userId, doc.projectId, doc.title, doc.content, doc.templateType, doc.updatedAt],
  );
  return r.rows.length > 0 ? toDoc(r.rows[0]) : doc;
}

// ---------- 집계 · 연결 ----------

/** 개요 탭 시간 집계 — 총 투입 · 이번 주(KST) (§5.1). */
export async function projectTimeSummary(
  projectId: string,
): Promise<{ totalMin: number; weekMin: number }> {
  const userId = await getUserId();
  const r = await getPool().query<{ total_min: string; week_min: string }>(
    `select coalesce(sum(end_min - start_min), 0) as total_min,
       coalesce(sum(end_min - start_min) filter (where (created_at at time zone 'Asia/Seoul')
         >= date_trunc('week', now() at time zone 'Asia/Seoul')), 0) as week_min
     from time_logs where user_id = $1 and project_id = $2`,
    [userId, projectId],
  );
  return { totalMin: Number(r.rows[0].total_min), weekMin: Number(r.rows[0].week_min) };
}

/** 연결된 연간 목표 — 연별 TO DO에서 프로젝트로 연결한 항목 (§5.1 ⑦). */
export async function linkedYearGoals(
  projectId: string,
): Promise<{ id: string; title: string; status: string; targetYear: number }[]> {
  const userId = await getUserId();
  const r = await getPool().query<{ id: string; title: string; status: string; target_year: number }>(
    `select id, title, status, target_year from tasks
     where user_id = $1 and project_id = $2 and target_year is not null
     order by target_year desc, created_at`,
    [userId, projectId],
  );
  return r.rows.map((row) => ({
    id: row.id,
    title: row.title,
    status: row.status,
    targetYear: row.target_year,
  }));
}

/** 타임로그 `#프로젝트명` 자동 연결용 — 제목 정확 일치(대소문자 무시). */
export async function findProjectIdByTag(tag: string): Promise<string | null> {
  const userId = await getUserId();
  const r = await getPool().query<{ id: string }>(
    "select id from projects where user_id = $1 and lower(title) = lower($2) limit 1",
    [userId, tag],
  );
  return r.rows.length > 0 ? r.rows[0].id : null;
}

/** 런처 프로젝트 타일 — 진행 중 수 · 최근 활동 프로젝트 · 지연 태스크 배지 (§7). */
export async function projectTileCounts(): Promise<{
  activeCount: number;
  recent: { title: string; progress: number } | null;
  hasOverdue: boolean;
}> {
  const userId = await getUserId();
  const pool = getPool();
  const [counts, overdue] = await Promise.all([
    pool.query<{ active_count: string }>(
      `select count(*) filter (where status in ('active','live')) as active_count
       from projects where user_id = $1`,
      [userId],
    ),
    pool.query<{ exists: boolean }>(
      `select exists(select 1 from tasks
         where user_id = $1 and project_id is not null
           and status not in ('done','dropped') and due_date < current_date) as exists`,
      [userId],
    ),
  ]);
  const cards = await listProjectCards();
  const recentActive = cards.find((c) => c.status === "active" || c.status === "live") ?? null;
  return {
    activeCount: Number(counts.rows[0].active_count),
    recent: recentActive ? { title: recentActive.title, progress: recentActive.progress } : null,
    hasOverdue: overdue.rows[0].exists,
  };
}
