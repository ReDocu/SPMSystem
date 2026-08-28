import { NextResponse } from "next/server";
import { isDbConfigured } from "@/lib/db";
import { isUuid } from "@/lib/ids";
import { deleteMilestone } from "@/lib/projects/repo";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!isDbConfigured()) return NextResponse.json({ error: "DB 미설정" }, { status: 503 });
  const { id } = await params;
  if (!isUuid(id)) return NextResponse.json({ error: "마일스톤이 없습니다" }, { status: 404 });

  try {
    const result = await deleteMilestone(id);
    if (!result) return NextResponse.json({ error: "마일스톤이 없습니다" }, { status: 404 });
    // 삭제 행 + FK로 풀린 태스크 목록 — 클라이언트의 5초 되돌리기 재료
    return NextResponse.json(result);
  } catch (error) {
    console.error("milestones DELETE 실패:", error);
    return NextResponse.json({ error: "삭제하지 못했습니다" }, { status: 500 });
  }
}
