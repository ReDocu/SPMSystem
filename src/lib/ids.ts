const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// 잘못된 id가 Postgres까지 가면 uuid 캐스트 오류로 500이 된다 — 라우트에서 먼저 거른다
export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_RE.test(value);
}
