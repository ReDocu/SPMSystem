import { NextResponse, type NextRequest } from "next/server";
import { isDbConfigured } from "@/lib/db";
import { processAsTask } from "@/lib/inbox/repo";

// v0.1 전환 종착지는 할 일뿐 — 자료(v0.2)·프로젝트 태스크(v0.3)는 해당 영역과 함께 (ISSUE-11)
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
  if (body.as !== "task") {
    return NextResponse.json({ error: "지원하지 않는 전환 유형입니다" }, { status: 400 });
  }

  try {
    const result = await processAsTask(id);
    if (!result) return NextResponse.json({ error: "항목이 없습니다" }, { status: 404 });
    return NextResponse.json(result);
  } catch (error) {
    console.error("inbox process 실패:", error);
    return NextResponse.json({ error: "처리하지 못했습니다" }, { status: 500 });
  }
}
