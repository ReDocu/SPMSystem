import { NextResponse, type NextRequest } from "next/server";
import { isDbConfigured } from "@/lib/db";
import { processAsTask, processAsTimelog } from "@/lib/inbox/repo";
import { toDateKey } from "@/lib/dates";

// v0.1 전환 종착지는 할 일·타임로그 — 자료(v0.2)·프로젝트 태스크(v0.3)는 해당 영역과 함께 (ISSUE-11)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!isDbConfigured()) return NextResponse.json({ error: "DB 미설정" }, { status: 503 });
  const { id } = await params;

  let body: { as?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청 본문" }, { status: 400 });
  }

  try {
    if (body.as === "task") {
      const result = await processAsTask(id);
      if (!result) return NextResponse.json({ error: "항목이 없습니다" }, { status: 404 });
      return NextResponse.json(result);
    }
    if (body.as === "timelog") {
      const result = await processAsTimelog(id, toDateKey(new Date()));
      if (!result) return NextResponse.json({ error: "항목이 없습니다" }, { status: 404 });
      if (result === "no_time_range") {
        return NextResponse.json({ error: "시간 범위가 없는 항목입니다" }, { status: 400 });
      }
      return NextResponse.json(result);
    }
    return NextResponse.json({ error: "지원하지 않는 전환 유형입니다" }, { status: 400 });
  } catch (error) {
    console.error("inbox process 실패:", error);
    return NextResponse.json({ error: "처리하지 못했습니다" }, { status: 500 });
  }
}
