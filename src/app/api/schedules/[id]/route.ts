import { NextResponse, type NextRequest } from "next/server";
import { isDbConfigured } from "@/lib/db";
import { isUuid } from "@/lib/ids";
import { deleteEvent, updateEvent } from "@/lib/schedule/events";
import { parseEventInput } from "@/lib/schedule/event-input";

// 시리즈 수정 (전체 필드 교체 방식 — 인라인 폼이 전체를 보낸다)
export async function PATCH(
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

  const parsed = parseEventInput(body);
  if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });

  try {
    const item = await updateEvent(id, parsed.input);
    if (!item) return NextResponse.json({ error: "일정이 없습니다" }, { status: 404 });
    return NextResponse.json({ item });
  } catch (error) {
    console.error("schedules PATCH 실패:", error);
    return NextResponse.json({ error: "수정하지 못했습니다" }, { status: 500 });
  }
}

// 즉시 삭제 — 삭제 행 반환으로 5초 되돌리기 지원
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!isDbConfigured()) return NextResponse.json({ error: "DB 미설정" }, { status: 503 });
  const { id } = await params;
  if (!isUuid(id)) return NextResponse.json({ error: "일정이 없습니다" }, { status: 404 });

  try {
    const item = await deleteEvent(id);
    if (!item) return NextResponse.json({ error: "일정이 없습니다" }, { status: 404 });
    return NextResponse.json({ item });
  } catch (error) {
    console.error("schedules DELETE 실패:", error);
    return NextResponse.json({ error: "삭제하지 못했습니다" }, { status: 500 });
  }
}
