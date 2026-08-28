import { getPool } from "@/lib/db";

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
