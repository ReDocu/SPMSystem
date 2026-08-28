import { NextResponse, type NextRequest } from "next/server";
import { isDbConfigured } from "@/lib/db";
import { isUuid } from "@/lib/ids";
import { addExdate, removeExdate } from "@/lib/schedule/events";
import { isDateKey } from "@/lib/schedule/validate";

async function readDate(request: NextRequest): Promise<string | null> {
  try {
    const body = (await request.json()) as { date?: unknown };
    return isDateKey(body.date) ? body.date : null;
  } catch {
    return null;
  }
}

// 회차 취소 (EXDATE) — "이번 주 수업 휴강". 회차 변경은 취소 + 단발 생성 조합 (§5.5)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!isDbConfigured()) return NextResponse.json({ error: "DB 미설정" }, { status: 503 });
  const { id } = await params;
  if (!isUuid(id)) return NextResponse.json({ error: "일정이 없습니다" }, { status: 404 });

  const date = await readDate(request);
  if (!date) return NextResponse.json({ error: "날짜가 올바르지 않습니다" }, { status: 400 });

  try {
    const ok = await addExdate(id, date);
    if (!ok) return NextResponse.json({ error: "일정이 없거나 이미 취소된 회차입니다" }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("schedules exdate 실패:", error);
    return NextResponse.json({ error: "처리하지 못했습니다" }, { status: 500 });
  }
}

// 회차 취소 되돌리기 (5초 undo)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!isDbConfigured()) return NextResponse.json({ error: "DB 미설정" }, { status: 503 });
  const { id } = await params;
  if (!isUuid(id)) return NextResponse.json({ error: "일정이 없습니다" }, { status: 404 });

  const date = await readDate(request);
  if (!date) return NextResponse.json({ error: "날짜가 올바르지 않습니다" }, { status: 400 });

  try {
    const ok = await removeExdate(id, date);
    if (!ok) return NextResponse.json({ error: "취소된 회차가 아닙니다" }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("schedules exdate 복원 실패:", error);
    return NextResponse.json({ error: "처리하지 못했습니다" }, { status: 500 });
  }
}
