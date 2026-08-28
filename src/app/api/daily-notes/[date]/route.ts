import { NextResponse, type NextRequest } from "next/server";
import { isDbConfigured } from "@/lib/db";
import { upsertDailyNote } from "@/lib/schedule/repo";
import { isCondition, isDateKey } from "@/lib/schedule/validate";

const MAX_NOTE_LENGTH = 2000;

// 데일리 노트·컨디션 — 부분 갱신 upsert (한 줄 노트, 이모지 1탭)
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ date: string }> },
) {
  if (!isDbConfigured()) return NextResponse.json({ error: "DB 미설정" }, { status: 503 });
  const { date } = await params;
  if (!isDateKey(date)) return NextResponse.json({ error: "날짜가 올바르지 않습니다" }, { status: 400 });

  let body: { content?: unknown; condition?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청 본문" }, { status: 400 });
  }

  const patch: { content?: string | null; condition?: number | null } = {};
  if (body.content !== undefined) {
    if (body.content !== null && typeof body.content !== "string") {
      return NextResponse.json({ error: "노트가 올바르지 않습니다" }, { status: 400 });
    }
    const trimmed = typeof body.content === "string" ? body.content.trim() : null;
    if (trimmed && trimmed.length > MAX_NOTE_LENGTH) {
      return NextResponse.json({ error: "노트가 너무 깁니다" }, { status: 400 });
    }
    patch.content = trimmed || null;
  }
  if (body.condition !== undefined) {
    if (body.condition !== null && !isCondition(body.condition)) {
      return NextResponse.json({ error: "컨디션 값이 올바르지 않습니다" }, { status: 400 });
    }
    patch.condition = body.condition as number | null;
  }
  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "변경할 내용이 없습니다" }, { status: 400 });
  }

  try {
    const note = await upsertDailyNote(date, patch);
    return NextResponse.json({ note });
  } catch (error) {
    console.error("daily-notes PUT 실패:", error);
    return NextResponse.json({ error: "저장하지 못했습니다" }, { status: 500 });
  }
}
