export function toDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function addDays(base: Date, days: number): Date {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d;
}

export function formatKoreanDate(d: Date): string {
  const weekday = ["일", "월", "화", "수", "목", "금", "토"][d.getDay()];
  return `${toDateKey(d)} (${weekday})`;
}
