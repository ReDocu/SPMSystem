// 클라이언트에서도 쓰는 일정 타입·상수 (pg 격리)

export type EventCategory = "일반" | "기념일" | "출장" | "수업";

export const EVENT_CATEGORIES: EventCategory[] = ["일반", "기념일", "출장", "수업"];

// 카테고리별 색 (상세기획 §5.4)
export const CATEGORY_COLORS: Record<EventCategory, string> = {
  일반: "#1971C2",
  기념일: "#E8590C",
  출장: "#9C36B5",
  수업: "#2F9E44",
};

export const CATEGORY_ICONS: Partial<Record<EventCategory, string>> = {
  기념일: "🎂",
  출장: "✈",
  수업: "📚",
};

export interface ScheduleEvent {
  id: string;
  title: string;
  category: EventCategory;
  allDay: boolean;
  rrule: string | null;
  exdates: string[];
  startDate: string; // 시리즈 시작일 (YYYY-MM-DD)
  endDate: string; // 시리즈 종료일 (여러 날 단발용)
  startMin: number; // 하루 안의 시각 (all_day면 0)
  endMin: number;
}

/** 특정 날짜에 실체화된 회차 — 달별 셀·일별 패널의 렌더 단위. */
export interface EventOccurrence {
  event: ScheduleEvent;
  date: string;
  spanDays: number;
  dayIndex: number;
}

export const RRULE_OPTIONS = [
  { value: "", label: "반복 없음" },
  { value: "FREQ=DAILY", label: "매일" },
  { value: "FREQ=WEEKLY", label: "매주" },
  { value: "FREQ=MONTHLY", label: "매월" },
  { value: "FREQ=YEARLY", label: "매년" },
] as const;
