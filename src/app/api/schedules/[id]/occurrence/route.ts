import { NextResponse, type NextRequest } from "next/server";
import { isDbConfigured } from "@/lib/db";
import { isUuid } from "@/lib/ids";
import { editOccurrence } from "@/lib/schedule/events";
import { parseEventInput } from "@/lib/schedule/event-input";
import { isDateKey } from "@/lib/schedule/validate";

// "이 회차만 변경" — 회차 취소 + 단발 생성을 서버에서 원자적으로 (§5.5)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!isDbConfigured()) return NextResponse.json({ error: "DB 미설정" }, { status: 503 });
  const { id } = await params;
  if (!isUuid(id)) return NextResponse.json({ error: "일정이 없습니다" }, { status: 404 });

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청 본문" }, { status: 400 });
  }

  if (!isDateKey(body.occurrenceDate)) {
    return NextResponse.json({ error: "회차 날짜가 올바르지 않습니다" }, { status: 400 });
  }
  const parsed = parseEventInput({ ...body, rrule: "", endDate: null });
  if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });

  try {
    const item = await editOccurrence(id, body.occurrenceDate as string, parsed.input);
    if (!item) {
      return NextResponse.json({ error: "일정이 없거나 이미 취소된 회차입니다" }, { status: 404 });
    }
    return NextResponse.json({ item }, { status: 201 });
  } catch (error) {
    console.error("schedules occurrence 실패:", error);
    return NextResponse.json({ error: "처리하지 못했습니다" }, { status: 500 });
  }
}
