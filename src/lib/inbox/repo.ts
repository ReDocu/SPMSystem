import { getPool } from "@/lib/db";
import { parseCapture } from "@/lib/capture/parse";
import { fetchPageMeta } from "@/lib/resources/repo";
import { FALLBACK_CATEGORY } from "@/lib/resources/model";
import { hostOf } from "@/lib/resources/meta";
import { getUserId } from "@/lib/user";

export { getUserId } from "@/lib/user";

export type InboxSource = "web" | "bookmarklet" | "mobile";

export interface InboxItem {
  id: string;
  rawText: string;
  source: InboxSource;
  guessedType: string;
  createdAt: string;
}

interface InboxRow {
  id: string;
  raw_text: string;
  source: InboxSource;
  guessed_type: string;
  created_at: string;
}

// ISO(UTC)로 내보내 클라이언트 new Date()와 ::timestamptz 복원 양쪽에서 안전하게 파싱되게 한다
const CREATED_ISO = `to_char(created_at at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.US') || 'Z'`;
const ROW_FIELDS = `id, raw_text, source, guessed_type, ${CREATED_ISO} as created_at`;

function toItem(row: InboxRow): InboxItem {
  return {
    id: row.id,
    rawText: row.raw_text,
    source: row.source,
    guessedType: row.guessed_type,
    createdAt: row.created_at,
  };
}

export async function listUnprocessed(): Promise<InboxItem[]> {
  const userId = await getUserId();
  const r = await getPool().query<InboxRow>(
    `select ${ROW_FIELDS} from inbox_items
     where user_id = $1 and processed_at is null
     order by created_at desc`,
    [userId],
  );
  return r.rows.map(toItem);
}

export async function countUnprocessed(): Promise<number> {
  const userId = await getUserId();
  const r = await getPool().query<{ count: string }>(
    "select count(*) from inbox_items where user_id = $1 and processed_at is null",
    [userId],
  );
  return Number(r.rows[0].count);
}

export async function createItem(rawText: string, source: InboxSource): Promise<InboxItem> {
  const userId = await getUserId();
  const guess = parseCapture(rawText);
  const r = await getPool().query<InboxRow>(
    `insert into inbox_items (user_id, raw_text, source, guessed_type)
     values ($1, $2, $3, $4)
     returning ${ROW_FIELDS}`,
    [userId, rawText, source, guess.type],
  );
  return toItem(r.rows[0]);
}

/** 즉시 삭제 — 삭제된 행을 돌려줘 5초 되돌리기(restoreItem)에 쓴다 (§0.4 공통 규칙). */
export async function deleteItem(id: string): Promise<InboxItem | null> {
  const userId = await getUserId();
  const r = await getPool().query<InboxRow>(
    `delete from inbox_items where id = $1 and user_id = $2 returning ${ROW_FIELDS}`,
    [id, userId],
  );
  return r.rows.length > 0 ? toItem(r.rows[0]) : null;
}

export async function restoreItem(item: InboxItem): Promise<InboxItem> {
  const userId = await getUserId();
  const r = await getPool().query<InboxRow>(
    `insert into inbox_items (id, user_id, raw_text, source, guessed_type, created_at)
     values ($1, $2, $3, $4, $5, $6::timestamptz)
     on conflict (id) do nothing
     returning ${ROW_FIELDS}`,
    [item.id, userId, item.rawText, item.source, item.guessedType, item.createdAt],
  );
  return r.rows.length > 0 ? toItem(r.rows[0]) : item;
}

/**
 * 항목을 할 일(tasks)로 전환하고 처리 완료로 표시한다.
 * - "내일" 등 상대 날짜는 캡처 시점(created_at) 기준으로 파싱한다 (전환일 기준이면 날짜가 밀린다)
 * - 파싱 날짜는 마감일 + 그날의 할 일(planned_date)로 넣는다 — due_date만 있으면
 *   v0.1의 어느 목록(오늘/못 한 일/백로그)에도 나타나지 않는 고아가 된다
 */
export async function processAsTask(id: string): Promise<{ taskId: string } | null> {
  const userId = await getUserId();
  const client = await getPool().connect();
  try {
    await client.query("begin");
    const found = await client.query<{ raw_text: string; created_at: string }>(
      `update inbox_items set processed_at = now()
       where id = $1 and user_id = $2 and processed_at is null
       returning raw_text, ${CREATED_ISO} as created_at`,
      [id, userId],
    );
    if (found.rows.length === 0) {
      await client.query("rollback");
      return null;
    }
    const guess = parseCapture(found.rows[0].raw_text, new Date(found.rows[0].created_at));
    const task = await client.query<{ id: string }>(
      `insert into tasks (user_id, title, due_date, planned_date)
       values ($1, $2, $3, $3) returning id`,
      [userId, guess.title || found.rows[0].raw_text, guess.date ?? null],
    );
    await client.query("commit");
    return { taskId: task.rows[0].id };
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

/** 항목을 타임로그로 전환한다 — 시간 범위 추정이 있을 때만. 날짜 없으면 오늘 (상세기획 §4.7). */
export async function processAsTimelog(
  id: string,
  today: string,
): Promise<{ logId: string } | "no_time_range" | null> {
  const userId = await getUserId();
  const client = await getPool().connect();
  try {
    await client.query("begin");
    const found = await client.query<{ raw_text: string; created_at: string }>(
      `update inbox_items set processed_at = now()
       where id = $1 and user_id = $2 and processed_at is null
       returning raw_text, ${CREATED_ISO} as created_at`,
      [id, userId],
    );
    if (found.rows.length === 0) {
      await client.query("rollback");
      return null;
    }
    const guess = parseCapture(found.rows[0].raw_text, new Date(found.rows[0].created_at));
    if (!guess.timeRange) {
      await client.query("rollback");
      return "no_time_range";
    }
    const log = await client.query<{ id: string }>(
      `insert into time_logs (user_id, date, start_min, end_min, content)
       values ($1, $2, $3, $4, $5) returning id`,
      [userId, guess.date ?? today, guess.timeRange.startMin, guess.timeRange.endMin, guess.title],
    );
    await client.query("commit");
    return { logId: log.rows[0].id };
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

/**
 * 항목을 자료수집으로 전환한다 (상세기획-자료수집 §2.4·R3).
 * URL 추정 → 사이트(기본 카테고리 '기타', og 메타 자동 추출) / 그 외 → 아이디어.
 */
export async function processAsResource(id: string): Promise<{ resourceId: string } | null> {
  const userId = await getUserId();
  const pool = getPool();
  const found = await pool.query<{ raw_text: string; created_at: string }>(
    `select raw_text, ${CREATED_ISO} as created_at from inbox_items
     where id = $1 and user_id = $2 and processed_at is null`,
    [id, userId],
  );
  if (found.rows.length === 0) return null;
  const guess = parseCapture(found.rows[0].raw_text, new Date(found.rows[0].created_at));

  // 외부 메타 fetch는 트랜잭션 밖에서 (커넥션 점유 방지)
  const meta = guess.url ? await fetchPageMeta(guess.url) : null;

  const client = await pool.connect();
  try {
    await client.query("begin");
    const marked = await client.query(
      `update inbox_items set processed_at = now()
       where id = $1 and user_id = $2 and processed_at is null`,
      [id, userId],
    );
    if (marked.rowCount === 0) {
      await client.query("rollback");
      return null;
    }
    // 메타 추출이 실패하면 fetchPageMeta는 호스트명을 돌려준다 — 그때는 북마클릿이
    // 캡처해온 문서 제목(guess.title)이 더 낫다
    const host = guess.url ? hostOf(guess.url) : null;
    const metaTitle = meta && meta.title !== host ? meta.title : null;
    const capturedTitle = guess.title && guess.title !== guess.url ? guess.title : null;
    const siteTitle = metaTitle ?? capturedTitle ?? meta?.title ?? guess.url;
    const inserted = guess.url
      ? await client.query<{ id: string }>(
          `insert into resources (user_id, type, url, title, memo, thumbnail, category)
           values ($1, 'site', $2, $3, $4, $5, $6) returning id`,
          [
            userId,
            guess.url,
            siteTitle,
            metaTitle && capturedTitle ? capturedTitle : null,
            meta?.thumbnail ?? null,
            FALLBACK_CATEGORY,
          ],
        )
      : await client.query<{ id: string }>(
          `insert into resources (user_id, type, title, content)
           values ($1, 'idea', $2, $3) returning id`,
          [userId, guess.title.split("\n")[0].slice(0, 80) || found.rows[0].raw_text.slice(0, 80), found.rows[0].raw_text],
        );
    await client.query("commit");
    return { resourceId: inserted.rows[0].id };
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

/** "모두 처리 완료" — 남은 항목 전부 처리 표시 (전환 없이 비우기). */
export async function processAll(): Promise<number> {
  const userId = await getUserId();
  const r = await getPool().query(
    "update inbox_items set processed_at = now() where user_id = $1 and processed_at is null",
    [userId],
  );
  return r.rowCount ?? 0;
}
