import { getPool } from "@/lib/db";
import { getUserId } from "@/lib/user";
// 장애 기록은 로드맵 버전 미배정 (운영배포-상세기획 §8 "초안 유지") — 미리 만들지 않는다
import type {
  ChecklistItem,
  Cost,
  Deployment,
  Environment,
  EnvironmentBackup,
  Platform,
  PlatformCategory,
  SecretMeta,
} from "@/lib/ops/model";

export type { Cost, Deployment, Environment, EnvironmentBackup, Platform };

// ---------- 플랫폼 카탈로그 (§3) ----------

interface PlatformRow {
  id: string;
  name: string;
  category: PlatformCategory;
  homepage_url: string | null;
  pricing_url: string | null;
  free_tier_note: string | null;
  is_custom: boolean;
}

const PLATFORM_FIELDS = "id, name, category, homepage_url, pricing_url, free_tier_note, is_custom";

const toPlatform = (r: PlatformRow): Platform => ({
  id: r.id,
  name: r.name,
  category: r.category,
  homepageUrl: r.homepage_url,
  pricingUrl: r.pricing_url,
  freeTierNote: r.free_tier_note,
  isCustom: r.is_custom,
});

export async function listPlatforms(category?: PlatformCategory): Promise<Platform[]> {
  const userId = await getUserId();
  const params: unknown[] = [userId];
  let where = "user_id = $1";
  if (category) {
    params.push(category);
    where += ` and category = $2`;
  }
  const r = await getPool().query<PlatformRow>(
    `select ${PLATFORM_FIELDS} from platforms where ${where} order by category, name`,
    params,
  );
  return r.rows.map(toPlatform);
}

export async function createPlatform(input: {
  name: string;
  category: PlatformCategory;
  homepageUrl?: string | null;
  pricingUrl?: string | null;
  freeTierNote?: string | null;
}): Promise<Platform> {
  const userId = await getUserId();
  const r = await getPool().query<PlatformRow>(
    `insert into platforms (user_id, name, category, homepage_url, pricing_url, free_tier_note, is_custom)
     values ($1, $2, $3, $4, $5, $6, true) returning ${PLATFORM_FIELDS}`,
    [userId, input.name, input.category, input.homepageUrl ?? null, input.pricingUrl ?? null, input.freeTierNote ?? null],
  );
  return toPlatform(r.rows[0]);
}

// ---------- 환경 (§6) ----------

interface EnvRow {
  id: string;
  project_id: string;
  project_title: string;
  name: string;
  platform_id: string | null;
  platform_name: string | null;
  host: string | null;
  domain: string | null;
  ssl_expires_at: string | null;
  secrets: SecretMeta[];
}

const ENV_SELECT = `select e.id, e.project_id, p.title as project_title, e.name,
  e.platform_id, pl.name as platform_name, e.host, e.domain,
  e.ssl_expires_at::text, e.secrets
  from environments e
  join projects p on p.id = e.project_id
  left join platforms pl on pl.id = e.platform_id`;

const toEnv = (r: EnvRow): Environment => ({
  id: r.id,
  projectId: r.project_id,
  projectTitle: r.project_title,
  name: r.name,
  platformId: r.platform_id,
  platformName: r.platform_name,
  host: r.host,
  domain: r.domain,
  sslExpiresAt: r.ssl_expires_at,
  secrets: Array.isArray(r.secrets) ? r.secrets : [],
});

export async function listEnvironments(projectId?: string): Promise<Environment[]> {
  const userId = await getUserId();
  const params: unknown[] = [userId];
  let where = "e.user_id = $1";
  if (projectId) {
    params.push(projectId);
    where += " and e.project_id = $2";
  }
  const r = await getPool().query<EnvRow>(
    `${ENV_SELECT} where ${where} order by p.title, e.name`,
    params,
  );
  return r.rows.map(toEnv);
}

export interface EnvironmentInput {
  projectId: string;
  name: string;
  platformId?: string | null;
  host?: string | null;
  domain?: string | null;
  sslExpiresAt?: string | null;
  secrets?: SecretMeta[];
}

export async function createEnvironment(input: EnvironmentInput): Promise<Environment | null> {
  const userId = await getUserId();
  const r = await getPool().query<{ id: string }>(
    `insert into environments (user_id, project_id, name, platform_id, host, domain, ssl_expires_at, secrets)
     select $1, id, $3, $4, $5, $6, $7, $8::jsonb from projects where id = $2 and user_id = $1
     returning id`,
    [
      userId,
      input.projectId,
      input.name,
      input.platformId ?? null,
      input.host ?? null,
      input.domain ?? null,
      input.sslExpiresAt ?? null,
      JSON.stringify(input.secrets ?? []),
    ],
  );
  if (r.rows.length === 0) return null;
  return getEnvironment(r.rows[0].id);
}

async function getEnvironment(id: string): Promise<Environment | null> {
  const userId = await getUserId();
  const r = await getPool().query<EnvRow>(`${ENV_SELECT} where e.id = $1 and e.user_id = $2`, [id, userId]);
  return r.rows.length > 0 ? toEnv(r.rows[0]) : null;
}

export async function updateEnvironment(
  id: string,
  patch: Omit<EnvironmentInput, "projectId">,
): Promise<Environment | null> {
  const userId = await getUserId();
  const r = await getPool().query(
    `update environments set name = $3, platform_id = $4, host = $5, domain = $6,
       ssl_expires_at = $7, secrets = $8::jsonb
     where id = $1 and user_id = $2`,
    [
      id,
      userId,
      patch.name,
      patch.platformId ?? null,
      patch.host ?? null,
      patch.domain ?? null,
      patch.sslExpiresAt ?? null,
      JSON.stringify(patch.secrets ?? []),
    ],
  );
  if ((r.rowCount ?? 0) === 0) return null;
  return getEnvironment(id);
}

/** 즉시 삭제 — cascade로 사라지는 배포 이력까지 백업해 돌려준다 (진짜 되돌리기 재료). */
export async function deleteEnvironment(id: string): Promise<EnvironmentBackup | null> {
  const env = await getEnvironment(id);
  if (!env) return null;
  const userId = await getUserId();
  const pool = getPool();
  const deploys = await pool.query<{
    id: string;
    version: string;
    deployed_at: string;
    changelog: string | null;
    rolled_back: boolean;
    checklist_snapshot: ChecklistItem[] | null;
  }>(
    `select id, version,
       to_char(deployed_at at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.US') || 'Z' as deployed_at,
       changelog, rolled_back, checklist_snapshot
     from deployments where user_id = $1 and environment_id = $2`,
    [userId, id],
  );
  await pool.query("delete from environments where id = $1 and user_id = $2", [id, userId]);
  return {
    environment: env,
    deployments: deploys.rows.map((d) => ({
      id: d.id,
      version: d.version,
      deployedAt: d.deployed_at,
      changelog: d.changelog,
      rolledBack: d.rolled_back,
      checklistSnapshot: Array.isArray(d.checklist_snapshot) ? d.checklist_snapshot : null,
    })),
  };
}

export async function restoreEnvironment(backup: EnvironmentBackup): Promise<void> {
  const userId = await getUserId();
  const env = backup.environment;
  const client = await getPool().connect();
  try {
    await client.query("begin");
    await client.query(
      `insert into environments (id, user_id, project_id, name, platform_id, host, domain, ssl_expires_at, secrets)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb) on conflict (id) do nothing`,
      [env.id, userId, env.projectId, env.name, env.platformId, env.host, env.domain, env.sslExpiresAt, JSON.stringify(env.secrets)],
    );
    for (const d of backup.deployments) {
      await client.query(
        `insert into deployments (id, user_id, environment_id, version, deployed_at, changelog, rolled_back, checklist_snapshot)
         values ($1, $2, $3, $4, $5::timestamptz, $6, $7, $8::jsonb) on conflict (id) do nothing`,
        [d.id, userId, env.id, d.version, d.deployedAt, d.changelog, d.rolledBack,
          d.checklistSnapshot ? JSON.stringify(d.checklistSnapshot) : null],
      );
    }
    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

// ---------- 배포 이력 (§7) ----------

interface DeployRow {
  id: string;
  environment_id: string;
  env_name: string;
  project_title: string;
  version: string;
  deployed_at: string;
  changelog: string | null;
  rolled_back: boolean;
  checklist_snapshot: ChecklistItem[] | null;
}

const DEPLOY_SELECT = `select d.id, d.environment_id, e.name as env_name, p.title as project_title,
  to_char(d.deployed_at at time zone 'Asia/Seoul', 'YYYY-MM-DD HH24:MI') as deployed_at,
  d.version, d.changelog, d.rolled_back, d.checklist_snapshot
  from deployments d
  join environments e on e.id = d.environment_id
  join projects p on p.id = e.project_id`;

const toDeploy = (r: DeployRow): Deployment => ({
  id: r.id,
  environmentId: r.environment_id,
  envName: r.env_name,
  projectTitle: r.project_title,
  version: r.version,
  deployedAt: r.deployed_at,
  changelog: r.changelog,
  rolledBack: r.rolled_back,
  checklistSnapshot: Array.isArray(r.checklist_snapshot) ? r.checklist_snapshot : null,
});

export async function listDeployments(limit = 50): Promise<Deployment[]> {
  const userId = await getUserId();
  const r = await getPool().query<DeployRow>(
    `${DEPLOY_SELECT} where d.user_id = $1 order by d.deployed_at desc limit $2`,
    [userId, limit],
  );
  return r.rows.map(toDeploy);
}

export async function createDeployment(input: {
  environmentId: string;
  version: string;
  changelog?: string | null;
  checklist?: ChecklistItem[] | null;
}): Promise<Deployment | null> {
  const userId = await getUserId();
  const r = await getPool().query<{ id: string }>(
    `insert into deployments (user_id, environment_id, version, changelog, checklist_snapshot)
     select $1, id, $3, $4, $5::jsonb from environments where id = $2 and user_id = $1
     returning id`,
    [userId, input.environmentId, input.version, input.changelog ?? null,
      input.checklist ? JSON.stringify(input.checklist) : null],
  );
  if (r.rows.length === 0) return null;
  const d = await getPool().query<DeployRow>(
    `${DEPLOY_SELECT} where d.id = $1 and d.user_id = $2`,
    [r.rows[0].id, userId],
  );
  return d.rows.length > 0 ? toDeploy(d.rows[0]) : null;
}

export async function setRolledBack(id: string, rolledBack: boolean): Promise<boolean> {
  const userId = await getUserId();
  const r = await getPool().query(
    "update deployments set rolled_back = $3 where id = $1 and user_id = $2",
    [id, userId, rolledBack],
  );
  return (r.rowCount ?? 0) > 0;
}

/** 기본 체크리스트 템플릿 (프로젝트 커스텀이 있으면 그것을 우선). */
export async function checklistFor(projectId: string | null): Promise<string[]> {
  const userId = await getUserId();
  const r = await getPool().query<{ items: string[] }>(
    `select items from checklist_templates
     where user_id = $1 and (project_id = $2 or project_id is null)
     order by project_id nulls last limit 1`,
    [userId, projectId],
  );
  return Array.isArray(r.rows[0]?.items) ? r.rows[0].items : [];
}

// ---------- 비용 (§9) ----------

interface CostRow {
  id: string;
  project_id: string | null;
  platform_id: string | null;
  platform_name: string | null;
  pricing_url: string | null;
  name: string;
  amount: string | number;
  currency: string;
  cycle: string;
  next_billing_at: string | null;
  price_checked_at: string | null;
}

const COST_SELECT = `select c.id, c.project_id, c.platform_id, pl.name as platform_name,
  pl.pricing_url, c.name, c.amount, c.currency, c.cycle,
  c.next_billing_at::text, c.price_checked_at::text
  from costs c left join platforms pl on pl.id = c.platform_id`;

const toCost = (r: CostRow): Cost => ({
  id: r.id,
  projectId: r.project_id,
  platformId: r.platform_id,
  platformName: r.platform_name,
  pricingUrl: r.pricing_url,
  name: r.name,
  amount: Number(r.amount),
  currency: r.currency,
  cycle: r.cycle,
  nextBillingAt: r.next_billing_at,
  priceCheckedAt: r.price_checked_at,
});

export async function listCosts(): Promise<Cost[]> {
  const userId = await getUserId();
  const r = await getPool().query<CostRow>(
    `${COST_SELECT} where c.user_id = $1 order by c.cycle, c.name`,
    [userId],
  );
  return r.rows.map(toCost);
}

export interface CostInput {
  name: string;
  amount: number;
  currency: string;
  cycle: string;
  platformId?: string | null;
  projectId?: string | null;
  nextBillingAt?: string | null;
}

/** 가격 확인 3단계의 ③ — 저장 시 price_checked_at을 함께 기록한다 (O1). */
export async function createCost(input: CostInput): Promise<Cost> {
  const userId = await getUserId();
  const r = await getPool().query<{ id: string }>(
    `insert into costs (user_id, name, amount, currency, cycle, platform_id, project_id, next_billing_at, price_checked_at)
     values ($1, $2, $3, $4, $5, $6, $7, $8, current_date) returning id`,
    [userId, input.name, input.amount, input.currency, input.cycle,
      input.platformId ?? null, input.projectId ?? null, input.nextBillingAt ?? null],
  );
  return (await getCost(r.rows[0].id))!;
}

async function getCost(id: string): Promise<Cost | null> {
  const userId = await getUserId();
  const r = await getPool().query<CostRow>(`${COST_SELECT} where c.id = $1 and c.user_id = $2`, [id, userId]);
  return r.rows.length > 0 ? toCost(r.rows[0]) : null;
}

/** 재확인 — 가격·주기·갱신일 갱신 + price_checked_at 오늘로. */
export async function recheckCost(
  id: string,
  patch: { amount: number; currency: string; cycle: string; nextBillingAt?: string | null },
): Promise<Cost | null> {
  const userId = await getUserId();
  // 갱신일을 비워 보내면 실제로 지운다 — coalesce로 되살리면 해지한 구독이 만료 임박에 계속 뜬다
  const r = await getPool().query(
    `update costs set amount = $3, currency = $4, cycle = $5,
       next_billing_at = $6, price_checked_at = current_date
     where id = $1 and user_id = $2`,
    [id, userId, patch.amount, patch.currency, patch.cycle, patch.nextBillingAt ?? null],
  );
  if ((r.rowCount ?? 0) === 0) return null;
  return getCost(id);
}

export async function deleteCost(id: string): Promise<Cost | null> {
  const cost = await getCost(id);
  if (!cost) return null;
  const userId = await getUserId();
  await getPool().query("delete from costs where id = $1 and user_id = $2", [id, userId]);
  return cost;
}

export async function restoreCost(cost: Cost): Promise<void> {
  const userId = await getUserId();
  await getPool().query(
    `insert into costs (id, user_id, project_id, platform_id, name, amount, currency, cycle, next_billing_at, price_checked_at)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) on conflict (id) do nothing`,
    [cost.id, userId, cost.projectId, cost.platformId, cost.name, cost.amount, cost.currency,
      cost.cycle, cost.nextBillingAt, cost.priceCheckedAt],
  );
}

// ---------- 대시보드 · 런처 타일 (§5) ----------

export interface LiveProjectCard {
  projectId: string;
  title: string;
  color: string | null;
  environments: Environment[];
  latestDeploy: { version: string; deployedAt: string } | null;
}

export interface ExpiringItem {
  kind: "ssl" | "billing";
  label: string;
  date: string;
  daysLeft: number;
}

export async function liveProjectCards(): Promise<LiveProjectCard[]> {
  const userId = await getUserId();
  const pool = getPool();
  const projects = await pool.query<{ id: string; title: string; color: string | null }>(
    "select id, title, color from projects where user_id = $1 and status = 'live' order by title",
    [userId],
  );
  const cards: LiveProjectCard[] = [];
  for (const p of projects.rows) {
    const envs = await listEnvironments(p.id);
    const deploy = await pool.query<{ version: string; deployed_at: string }>(
      `select d.version, to_char(d.deployed_at at time zone 'Asia/Seoul', 'MM/DD') as deployed_at
       from deployments d join environments e on e.id = d.environment_id
       where d.user_id = $1 and e.project_id = $2 order by d.deployed_at desc limit 1`,
      [userId, p.id],
    );
    cards.push({
      projectId: p.id,
      title: p.title,
      color: p.color,
      environments: envs,
      latestDeploy: deploy.rows[0]
        ? { version: deploy.rows[0].version, deployedAt: deploy.rows[0].deployed_at }
        : null,
    });
  }
  return cards;
}

/** 만료 임박 D-30 — SSL·도메인·구독 갱신 통합 목록 (§5). */
export async function listExpiring(today: string): Promise<ExpiringItem[]> {
  const userId = await getUserId();
  const pool = getPool();
  const [ssl, billing] = await Promise.all([
    pool.query<{ label: string; date: string; days: number }>(
      `select p.title || ' ' || coalesce(e.domain, e.name) || ' SSL' as label,
         e.ssl_expires_at::text as date, e.ssl_expires_at - $2::date as days
       from environments e join projects p on p.id = e.project_id
       where e.user_id = $1 and e.ssl_expires_at is not null
         and e.ssl_expires_at between $2::date and $2::date + 30`,
      [userId, today],
    ),
    pool.query<{ label: string; date: string; days: number }>(
      `select name || ' 갱신' as label, next_billing_at::text as date,
         next_billing_at - $2::date as days
       from costs
       where user_id = $1 and next_billing_at is not null
         and next_billing_at between $2::date and $2::date + 30`,
      [userId, today],
    ),
  ]);
  return [
    ...ssl.rows.map((r) => ({ kind: "ssl" as const, label: r.label, date: r.date, daysLeft: Number(r.days) })),
    ...billing.rows.map((r) => ({ kind: "billing" as const, label: r.label, date: r.date, daysLeft: Number(r.days) })),
  ].sort((a, b) => a.daysLeft - b.daysLeft);
}

export async function opsTileCounts(today: string): Promise<{
  liveCount: number;
  latestDeploy: string | null;
  expiringSoon: boolean; // D-7 내 → 🟡
}> {
  const userId = await getUserId();
  const pool = getPool();
  const [live, deploy, expiring] = await Promise.all([
    pool.query<{ count: string }>(
      "select count(*) from projects where user_id = $1 and status = 'live'",
      [userId],
    ),
    pool.query<{ label: string }>(
      `select p.title || ' ' || d.version as label
       from deployments d
       join environments e on e.id = d.environment_id
       join projects p on p.id = e.project_id
       where d.user_id = $1 order by d.deployed_at desc limit 1`,
      [userId],
    ),
    pool.query<{ exists: boolean }>(
      `select exists(
         select 1 from environments where user_id = $1 and ssl_expires_at between $2::date and $2::date + 7
         union all
         select 1 from costs where user_id = $1 and next_billing_at between $2::date and $2::date + 7
       ) as exists`,
      [userId, today],
    ),
  ]);
  return {
    liveCount: Number(live.rows[0].count),
    latestDeploy: deploy.rows[0]?.label ?? null,
    expiringSoon: expiring.rows[0].exists,
  };
}
