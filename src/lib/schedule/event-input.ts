import { EVENT_CATEGORIES, RRULE_OPTIONS, type EventCategory } from "@/lib/schedule/event-model";
import type { EventInput } from "@/lib/schedule/events";
import { isDateKey, isMinuteRange } from "@/lib/schedule/validate";

const MAX_TITLE = 200;
// 옵션 목록에서 파생 — 손으로 복제하면 새 옵션이 조용히 '반복 없음'으로 강등된다
const RRULES: string[] = RRULE_OPTIONS.map((o) => o.value);

const isValidMinute = (v: unknown): v is number =>
  typeof v === "number" && Number.isInteger(v) && v >= 0 && v <= 24 * 60;

/** 일정 생성·수정 요청 본문 공용 검증. */
export function parseEventInput(
  body: Record<string, unknown>,
): { input: EventInput } | { error: string } {
  const title = typeof body.title === "string" ? body.title.trim().slice(0, MAX_TITLE) : "";
  if (!title) return { error: "제목이 비어 있습니다" };
  if (!isDateKey(body.date)) return { error: "날짜가 올바르지 않습니다" };

  const allDay = body.allDay === true;
  const category = EVENT_CATEGORIES.includes(body.category as EventCategory)
    ? (body.category as EventCategory)
    : "일반";
  const rrule = typeof body.rrule === "string" && RRULES.includes(body.rrule) ? body.rrule : "";

  let endDate: string | null = null;
  if (body.endDate != null && body.endDate !== body.date) {
    if (!isDateKey(body.endDate)) return { error: "종료일이 올바르지 않습니다" };
    if ((body.endDate as string) < body.date) return { error: "종료일이 시작일보다 빠릅니다" };
    if (rrule) return { error: "반복 일정은 여러 날 범위를 가질 수 없습니다" };
    endDate = body.endDate as string;
  }

  if (!allDay) {
    if (endDate) {
      // 여러 날 + 시간: 날짜가 다르므로 순서 제약 없음 — 분 값 자체만 검증
      if (!isValidMinute(body.startMin) || !isValidMinute(body.endMin)) {
        return { error: "시간이 올바르지 않습니다" };
      }
    } else if (!isMinuteRange(body.startMin, body.endMin)) {
      return { error: "시간 범위가 올바르지 않습니다" };
    }
  }

  return {
    input: {
      title,
      date: body.date as string,
      endDate,
      startMin: typeof body.startMin === "number" ? body.startMin : null,
      endMin: typeof body.endMin === "number" ? body.endMin : null,
      allDay,
      category,
      rrule: rrule || null,
    },
  };
}
