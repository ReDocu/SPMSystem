export interface DailySummaryData {
  dateLabel: string;
  events: { time: string; title: string }[];
  anniversaries: { title: string; dday: number }[];
  dueTasks: string[];
  expiring: { label: string; dday: number }[];
  inboxCount: number;
  weekCollected: number;
  weekly: { totalMin: number; byProject: { title: string; min: number }[] } | null; // 월요일에만
}

const hours = (min: number) => (Number.isInteger(min / 60) ? `${min / 60}h` : `${(min / 60).toFixed(1)}h`);

/**
 * 일일 요약 메시지 조립 (기획서 §9.1) — 하루 한 번, 빈 섹션은 통째로 생략.
 * 주간 요약은 별도 발송이 아니라 월요일 일일 요약에 3줄 추가 (IMP-02).
 */
export function buildDailySummary(data: DailySummaryData): string {
  const lines: string[] = [`📋 ${data.dateLabel}`];

  if (data.events.length > 0 || data.anniversaries.length > 0) {
    lines.push("", "◷ 오늘 일정");
    for (const e of data.events) lines.push(` · ${e.time} ${e.title}`);
    for (const a of data.anniversaries) {
      lines.push(`🎂 ${a.title} ${a.dday === 0 ? "오늘" : `D-${a.dday}`}`);
    }
  }

  if (data.dueTasks.length > 0) {
    lines.push("", `오늘 마감 ${data.dueTasks.length}건`);
    for (const t of data.dueTasks) lines.push(` · ${t}`);
  }

  if (data.expiring.length > 0) {
    lines.push("", "⚠️ 확인 필요");
    for (const e of data.expiring) lines.push(` · ${e.label} D-${e.dday}`);
  }

  const footer: string[] = [];
  if (data.inboxCount > 0) footer.push(`📥 인박스 ${data.inboxCount}건 미처리`);
  if (data.weekCollected > 0) footer.push(`📚 이번 주 수집 ${data.weekCollected}건`);
  if (footer.length > 0) lines.push("", ...footer);

  if (data.weekly) {
    lines.push("", `📈 지난주 기록 ${hours(data.weekly.totalMin)}`);
    for (const p of data.weekly.byProject) lines.push(` · ${p.title} ${hours(p.min)}`);
  }

  return lines.join("\n");
}
