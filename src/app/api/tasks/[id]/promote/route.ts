import { NextResponse } from "next/server";
import { isDbConfigured } from "@/lib/db";
import { isUuid } from "@/lib/ids";
import { promoteYearTask } from "@/lib/schedule/repo";

// 연별 항목 [프로젝트로 만들기] → idea 프로젝트 생성, 원본 연결 유지 (USE-05)
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!isDbConfigured()) return NextResponse.json({ error: "DB 미설정" }, { status: 503 });
  const { id } = await params;
  if (!isUuid(id)) return NextResponse.json({ error: "항목이 없습니다" }, { status: 404 });

  try {
    const result = await promoteYearTask(id);
    if (!result) return NextResponse.json({ error: "연간 목표 항목이 아닙니다" }, { status: 404 });
    return NextResponse.json(result);
  } catch (error) {
    console.error("task promote 실패:", error);
    return NextResponse.json({ error: "승격하지 못했습니다" }, { status: 500 });
  }
}
