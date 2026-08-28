import { NextResponse, type NextRequest } from "next/server";
import { isDbConfigured } from "@/lib/db";
import { isUuid } from "@/lib/ids";
import { restoreEvent } from "@/lib/schedule/events";
import { EVENT_CATEGORIES, type EventCategory, type ScheduleEvent } from "@/lib/schedule/event-model";
import { isDateKey } from "@/lib/schedule/validate";

// 5초 되돌리기 — DELETE 응답 행을 그대로 복원
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!isDbConfigured()) return NextResponse.json({ error: "DB 미설정" }, { status: 503 });
  const { id } = await params;
  if (!isUuid(id)) return NextResponse.json({ error: "복원 대상이 없습니다" }, { status: 404 });

  let body: Partial<ScheduleEvent>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청 본문" }, { status: 400 });
  }

  if (
    typeof body.title !== "string" ||
    !isDateKey(body.startDate) ||
    !isDateKey(body.endDate) ||
    !EVENT_CATEGORIES.includes(body.category as EventCategory)
  ) {
    return NextResponse.json({ error: "복원 정보가 올바르지 않습니다" }, { status: 400 });
  }

  try {
    await restoreEvent({
      id,
      title: body.title,
      category: body.category as EventCategory,
      allDay: body.allDay === true,
      rrule: typeof body.rrule === "string" ? body.rrule : null,
      exdates: Array.isArray(body.exdates) ? body.exdates.filter((d): d is string => isDateKey(d)) : [],
      startDate: body.startDate,
      endDate: body.endDate,
      startMin: typeof body.startMin === "number" ? body.startMin : 0,
      endMin: typeof body.endMin === "number" ? body.endMin : 24 * 60,
    });
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (error) {
    console.error("schedules restore 실패:", error);
    return NextResponse.json({ error: "되돌리지 못했습니다" }, { status: 500 });
  }
}
