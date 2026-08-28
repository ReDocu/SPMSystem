import type { CaptureGuess, CaptureType, TimeRange } from "@/lib/capture/parse";

const TYPE_LABELS: Record<CaptureType, string> = {
  resource: "자료",
  task: "할 일",
  project_task: "프로젝트 태스크",
  snippet: "스니펫",
  timelog: "타임로그",
  event: "일정",
  idea: "아이디어",
};

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

export function typeLabel(type: CaptureType): string {
  return TYPE_LABELS[type];
}

// "2026-08-28" → "8/28 (금)" — 원문 옆 배지라 연도 생략 (화면명세서 §3 ①)
export function formatGuessDate(dateKey: string): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return `${m}/${d} (${WEEKDAYS[date.getDay()]})`;
}

export function formatTimeRange({ startMin, endMin }: TimeRange): string {
  const hhmm = (min: number) =>
    `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
  return `${hhmm(startMin)}–${hhmm(endMin)}`;
}

/** 인박스 카드·캡처 미리보기의 인라인 배지 목록. 유형 → 날짜 → 시간 순. */
export function guessBadges(guess: CaptureGuess): string[] {
  const badges = [
    guess.type === "project_task" && guess.project
      ? `#${guess.project} 태스크`
      : typeLabel(guess.type),
  ];
  if (guess.date) badges.push(formatGuessDate(guess.date));
  if (guess.timeRange) badges.push(formatTimeRange(guess.timeRange));
  return badges;
}
