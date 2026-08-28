import { NextResponse, type NextRequest } from "next/server";
import { isDbConfigured } from "@/lib/db";
import { createTask, createYearTask } from "@/lib/schedule/repo";
import { isDateKey } from "@/lib/schedule/validate";

const MAX_TITLE_LENGTH = 300;
const MIN_YEAR = 2000;
const MAX_YEAR = 2100;

// 인라인 추가 — plannedDate 주면 오늘 할 일, targetYear 주면 연간 목표, 없으면 백로그
export async function POST(request: NextRequest) {
  if (!isDbConfigured()) return NextResponse.json({ error: "DB 미설정" }, { status: 503 });

  let body: { title?: unknown; plannedDate?: unknown; targetYear?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청 본문" }, { status: 400 });
  }

  const title = typeof body.title === "string" ? body.title.trim() : "";
  if (!title || title.length > MAX_TITLE_LENGTH) {
    return NextResponse.json({ error: "제목이 비었거나 너무 깁니다" }, { status: 400 });
  }

  // plannedDate가 왔다면 어느 분기로 가든 형식은 유효해야 한다 (조용한 무시 방지)
  if (body.plannedDate !== undefined && body.plannedDate !== null && !isDateKey(body.plannedDate)) {
    return NextResponse.json({ error: "날짜가 올바르지 않습니다" }, { status: 400 });
  }

  try {
    if (body.targetYear !== undefined) {
      const year = body.targetYear;
      if (typeof year !== "number" || !Number.isInteger(year) || year < MIN_YEAR || year > MAX_YEAR) {
        return NextResponse.json({ error: "연도가 올바르지 않습니다" }, { status: 400 });
      }
      const task = await createYearTask(title, year);
      return NextResponse.json({ task }, { status: 201 });
    }

    const task = await createTask(title, (body.plannedDate as string | null | undefined) ?? null);
    return NextResponse.json({ task }, { status: 201 });
  } catch (error) {
    console.error("tasks POST 실패:", error);
    return NextResponse.json({ error: "저장하지 못했습니다" }, { status: 500 });
  }
}
