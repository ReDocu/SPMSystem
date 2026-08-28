const DATE_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_MIN = 24 * 60;

export function isDateKey(value: unknown): value is string {
  if (typeof value !== "string" || !DATE_KEY_RE.test(value)) return false;
  // new Date("2026-02-30")는 3월로 롤오버돼 통과하므로 왕복 비교로 검증한다
  const [y, m, d] = value.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d;
}

export function isMinuteRange(startMin: unknown, endMin: unknown): boolean {
  return (
    typeof startMin === "number" &&
    typeof endMin === "number" &&
    Number.isInteger(startMin) &&
    Number.isInteger(endMin) &&
    startMin >= 0 &&
    endMin <= MAX_MIN &&
    startMin < endMin
  );
}

export function isCondition(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= 4;
}
