import { NextResponse, type NextRequest } from "next/server";
import { isDbConfigured } from "@/lib/db";
import { createLog, deleteLogs, updateLogsContent } from "@/lib/schedule/repo";
import { isDateKey, isMinuteRange } from "@/lib/schedule/validate";

const MAX_CONTENT_LENGTH = 500;

function isIdList(value: unknown): value is string[] {
  return Array.isArray(value) && value.length > 0 && value.every((v) => typeof v === "string");
}

async function readJson(request: NextRequest): Promise<Record<string, unknown> | null> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest) {
  if (!isDbConfigured()) return NextResponse.json({ error: "DB 미설정" }, { status: 503 });
  const body = await readJson(request);
  if (!body) return NextResponse.json({ error: "잘못된 요청 본문" }, { status: 400 });

  const content = typeof body.content === "string" ? body.content.trim() : "";
  if (!content || content.length > MAX_CONTENT_LENGTH) {
    return NextResponse.json({ error: "내용이 비었거나 너무 깁니다" }, { status: 400 });
  }
  if (!isDateKey(body.date) || !isMinuteRange(body.startMin, body.endMin)) {
    return NextResponse.json({ error: "날짜 또는 시간 범위가 올바르지 않습니다" }, { status: 400 });
  }

  try {
    const log = await createLog(body.date, body.startMin as number, body.endMin as number, content);
    return NextResponse.json({ log }, { status: 201 });
  } catch (error) {
    console.error("timelogs POST 실패:", error);
    return NextResponse.json({ error: "저장하지 못했습니다" }, { status: 500 });
  }
}

// 병합 블록은 여러 행이므로 내용 수정·삭제는 id 목록으로 받는다
export async function PATCH(request: NextRequest) {
  if (!isDbConfigured()) return NextResponse.json({ error: "DB 미설정" }, { status: 503 });
  const body = await readJson(request);
  if (!body) return NextResponse.json({ error: "잘못된 요청 본문" }, { status: 400 });

  const content = typeof body.content === "string" ? body.content.trim() : "";
  if (!isIdList(body.ids) || !content || content.length > MAX_CONTENT_LENGTH) {
    return NextResponse.json({ error: "수정 정보가 올바르지 않습니다" }, { status: 400 });
  }

  try {
    const updated = await updateLogsContent(body.ids, content);
    if (updated === 0) return NextResponse.json({ error: "대상이 없습니다" }, { status: 404 });
    return NextResponse.json({ updated });
  } catch (error) {
    console.error("timelogs PATCH 실패:", error);
    return NextResponse.json({ error: "수정하지 못했습니다" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  if (!isDbConfigured()) return NextResponse.json({ error: "DB 미설정" }, { status: 503 });
  const body = await readJson(request);
  if (!body || !isIdList(body.ids)) {
    return NextResponse.json({ error: "삭제 대상이 없습니다" }, { status: 400 });
  }

  try {
    const deleted = await deleteLogs(body.ids);
    return NextResponse.json({ deleted });
  } catch (error) {
    console.error("timelogs DELETE 실패:", error);
    return NextResponse.json({ error: "삭제하지 못했습니다" }, { status: 500 });
  }
}
