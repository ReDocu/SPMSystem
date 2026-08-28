import { getPool } from "@/lib/db";
import { getUserId } from "@/lib/user";
import { extractPageMeta, hostOf } from "@/lib/resources/meta";
import { FALLBACK_CATEGORY, type Resource, type ResourceType } from "@/lib/resources/model";

export type { Resource, ResourceType } from "@/lib/resources/model";

const CREATED_ISO = `to_char(created_at at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.US') || 'Z'`;
const FIELDS = `id, type, url, title, memo, content, thumbnail, category, ${CREATED_ISO} as created_at`;

interface Row {
  id: string;
  type: ResourceType;
  url: string | null;
  title: string;
  memo: string | null;
  content: string | null;
  thumbnail: string | null;
  category: string | null;
  created_at: string;
}

const toResource = (r: Row): Resource => ({
  id: r.id,
  type: r.type,
  url: r.url,
  title: r.title,
  memo: r.memo,
  content: r.content,
  thumbnail: r.thumbnail,
  category: r.category,
  createdAt: r.created_at,
});

const META_FETCH_TIMEOUT_MS = 4000;
const META_MAX_BYTES = 512 * 1024;
const META_MAX_REDIRECTS = 3;

const PRIVATE_IPV4 =
  /^(127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|0\.)/;

// SSRF 방지 — 내부 호스트로 향하는 메타 fetch를 거부한다 (리다이렉트 홉마다 재검사)
function isBlockedHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (host === "localhost" || host.endsWith(".local") || host.endsWith(".internal")) return true;
  if (PRIVATE_IPV4.test(host)) return true;
  // IPv6 판정은 콜론이 있을 때만 — fcbarcelona.com 같은 도메인을 잡으면 안 된다
  if (host.includes(":") && (host === "::1" || /^fe80:|^f[cd]/.test(host))) return true;
  return false;
}

async function readBody(res: Response, maxBytes: number): Promise<string> {
  if (!res.body) return "";
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;
  while (received < maxBytes) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    received += value.byteLength;
  }
  await reader.cancel().catch(() => {});
  return new TextDecoder("utf-8", { fatal: false }).decode(
    Buffer.concat(chunks, Math.min(received, maxBytes)),
  );
}

/** URL 메타 자동 추출 — 실패해도 저장은 진행한다 (제목은 도메인으로). */
export async function fetchPageMeta(url: string): Promise<{ title: string; thumbnail?: string }> {
  const fallback = { title: hostOf(url) ?? url };
  try {
    let current = new URL(url);
    for (let hop = 0; hop <= META_MAX_REDIRECTS; hop++) {
      if (!["http:", "https:"].includes(current.protocol) || isBlockedHost(current.hostname)) {
        return fallback;
      }
      const res = await fetch(current, {
        signal: AbortSignal.timeout(META_FETCH_TIMEOUT_MS),
        headers: { "User-Agent": "SPM/0.2 (personal bookmark tool)" },
        redirect: "manual",
      });
      if (res.status >= 300 && res.status < 400) {
        const location = res.headers.get("location");
        await res.body?.cancel().catch(() => {});
        if (!location) return fallback;
        current = new URL(location, current);
        continue;
      }
      if (!res.ok || !(res.headers.get("content-type") ?? "").includes("text/html")) {
        await res.body?.cancel().catch(() => {});
        return fallback;
      }
      const html = await readBody(res, META_MAX_BYTES);
      return extractPageMeta(html, current.href);
    }
    return fallback;
  } catch {
    return fallback;
  }
}

export interface ResourceFilter {
  type?: ResourceType;
  category?: string;
  search?: string;
}

export async function listResources(filter: ResourceFilter): Promise<Resource[]> {
  const userId = await getUserId();
  const where: string[] = ["user_id = $1"];
  const params: unknown[] = [userId];
  if (filter.type) {
    params.push(filter.type);
    where.push(`type = $${params.length}`);
  }
  if (filter.category) {
    params.push(filter.category);
    where.push(`category = $${params.length}`);
  }
  if (filter.search) {
    params.push(`%${filter.search.replaceAll("\\", "\\\\").replaceAll("%", "\\%").replaceAll("_", "\\_")}%`);
    where.push(`(title ilike $${params.length} or memo ilike $${params.length} or content ilike $${params.length})`);
  }
  const r = await getPool().query<Row>(
    `select ${FIELDS} from resources where ${where.join(" and ")} order by created_at desc`,
    params,
  );
  return r.rows.map(toResource);
}

export async function getResource(id: string): Promise<Resource | null> {
  const userId = await getUserId();
  const r = await getPool().query<Row>(
    `select ${FIELDS} from resources where id = $1 and user_id = $2`,
    [id, userId],
  );
  return r.rows.length > 0 ? toResource(r.rows[0]) : null;
}

export async function createSite(input: {
  url: string;
  title: string;
  memo?: string | null;
  thumbnail?: string | null;
  category?: string | null;
}): Promise<Resource> {
  const userId = await getUserId();
  const r = await getPool().query<Row>(
    `insert into resources (user_id, type, url, title, memo, thumbnail, category)
     values ($1, 'site', $2, $3, $4, $5, $6) returning ${FIELDS}`,
    [userId, input.url, input.title, input.memo ?? null, input.thumbnail ?? null, input.category ?? FALLBACK_CATEGORY],
  );
  return toResource(r.rows[0]);
}

export async function createIdea(input: { title: string; content?: string | null }): Promise<Resource> {
  const userId = await getUserId();
  const r = await getPool().query<Row>(
    `insert into resources (user_id, type, title, content)
     values ($1, 'idea', $2, $3) returning ${FIELDS}`,
    [userId, input.title, input.content ?? null],
  );
  return toResource(r.rows[0]);
}

export async function updateResource(
  id: string,
  patch: { title?: string; memo?: string | null; content?: string | null; category?: string | null },
): Promise<Resource | null> {
  const userId = await getUserId();
  const sets: string[] = [];
  const params: unknown[] = [id, userId];
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) continue;
    params.push(value);
    sets.push(`${key} = $${params.length}`);
  }
  if (sets.length === 0) return getResource(id);
  const r = await getPool().query<Row>(
    `update resources set ${sets.join(", ")} where id = $1 and user_id = $2 returning ${FIELDS}`,
    [...params],
  );
  return r.rows.length > 0 ? toResource(r.rows[0]) : null;
}

/** 즉시 삭제 — 삭제 행을 돌려줘 5초 되돌리기에 쓴다 (공통 규칙 §0.4). */
export async function deleteResource(id: string): Promise<Resource | null> {
  const userId = await getUserId();
  const r = await getPool().query<Row>(
    `delete from resources where id = $1 and user_id = $2 returning ${FIELDS}`,
    [id, userId],
  );
  return r.rows.length > 0 ? toResource(r.rows[0]) : null;
}

export async function restoreResource(item: Resource): Promise<Resource> {
  const userId = await getUserId();
  const r = await getPool().query<Row>(
    `insert into resources (id, user_id, type, url, title, memo, content, thumbnail, category, created_at)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::timestamptz)
     on conflict (id) do nothing returning ${FIELDS}`,
    [item.id, userId, item.type, item.url, item.title, item.memo, item.content, item.thumbnail, item.category, item.createdAt],
  );
  return r.rows.length > 0 ? toResource(r.rows[0]) : item;
}

/** 런처 타일 — 이번 주(월요일 시작, KST 기준) 수집 수 + 아이디어 수 (상세기획 §4 R4). */
export async function resourceTileCounts(): Promise<{ weekCount: number; ideaCount: number }> {
  const userId = await getUserId();
  const r = await getPool().query<{ week_count: string; idea_count: string }>(
    `select
       count(*) filter (where (created_at at time zone 'Asia/Seoul')
         >= date_trunc('week', now() at time zone 'Asia/Seoul')) as week_count,
       count(*) filter (where type = 'idea') as idea_count
     from resources where user_id = $1`,
    [userId],
  );
  return { weekCount: Number(r.rows[0].week_count), ideaCount: Number(r.rows[0].idea_count) };
}

/** 카테고리별 사이트 수 — 좌측 필터용. */
export async function categoryCounts(): Promise<{ category: string; count: number }[]> {
  const userId = await getUserId();
  const r = await getPool().query<{ category: string | null; count: string }>(
    `select category, count(*) from resources
     where user_id = $1 and type = 'site' group by category`,
    [userId],
  );
  return r.rows.map((row) => ({ category: row.category ?? FALLBACK_CATEGORY, count: Number(row.count) }));
}
