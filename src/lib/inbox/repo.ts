import { getPool } from "@/lib/db";
import { parseCapture } from "@/lib/capture/parse";

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

const ROW_FIELDS = "id, raw_text, source, guessed_type, created_at::text";

function toItem(row: InboxRow): InboxItem {
  return {
    id: row.id,
    rawText: row.raw_text,
    source: row.source,
    guessedType: row.guessed_type,
    createdAt: row.created_at,
  };
}

// 1인 도구 — users의 유일한 행 (기획서 §7 규칙 2: user_id는 유지하되 조회는 단일)
let cachedUserId: string | undefined;

export async function getUserId(): Promise<string> {
  if (cachedUserId) return cachedUserId;
  const r = await getPool().query<{ id: string }>(
    "select id from users order by created_at limit 1",
  );
  if (r.rows.length === 0) throw new Error("users 테이블이 비어 있습니다 — 마이그레이션 확인");
  cachedUserId = r.rows[0].id;
  return cachedUserId;
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

/** 항목을 할 일(tasks)로 전환하고 처리 완료로 표시한다. 파싱 날짜는 마감일로 들어간다. */
export async function processAsTask(id: string): Promise<{ taskId: string } | null> {
  const userId = await getUserId();
  const client = await getPool().connect();
  try {
    await client.query("begin");
    const found = await client.query<{ raw_text: string }>(
      `update inbox_items set processed_at = now()
       where id = $1 and user_id = $2 and processed_at is null
       returning raw_text`,
      [id, userId],
    );
    if (found.rows.length === 0) {
      await client.query("rollback");
      return null;
    }
    const guess = parseCapture(found.rows[0].raw_text);
    const task = await client.query<{ id: string }>(
      `insert into tasks (user_id, title, due_date) values ($1, $2, $3) returning id`,
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

/** "모두 처리 완료" — 남은 항목 전부 처리 표시 (전환 없이 비우기). */
export async function processAll(): Promise<number> {
  const userId = await getUserId();
  const r = await getPool().query(
    "update inbox_items set processed_at = now() where user_id = $1 and processed_at is null",
    [userId],
  );
  return r.rowCount ?? 0;
}
