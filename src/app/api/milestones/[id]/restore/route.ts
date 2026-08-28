import { NextResponse, type NextRequest } from "next/server";
import { isDbConfigured } from "@/lib/db";
import { isUuid } from "@/lib/ids";
import { restoreMilestone, type Milestone } from "@/lib/projects/repo";

// 5초 되돌리기 — 마일스톤 행 + 태스크 연결까지 복원
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!isDbConfigured()) return NextResponse.json({ error: "DB 미설정" }, { status: 503 });
  const { id } = await params;
  if (!isUuid(id)) return NextResponse.json({ error: "복원 대상이 없습니다" }, { status: 404 });

  let body: { milestone?: Partial<Milestone>; taskIds?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청 본문" }, { status: 400 });
  }

  const ms = body.milestone;
  const taskIds = Array.isArray(body.taskIds) ? body.taskIds.filter((t): t is string => isUuid(t)) : [];
  if (
    !ms ||
    !isUuid(ms.projectId) ||
    typeof ms.title !== "string" ||
    typeof ms.weight !== "number"
  ) {
    return NextResponse.json({ error: "복원 정보가 올바르지 않습니다" }, { status: 400 });
  }

  try {
    await restoreMilestone(
      {
        id,
        projectId: ms.projectId,
        title: ms.title,
        dueDate: typeof ms.dueDate === "string" ? ms.dueDate : null,
        weight: Math.min(10, Math.max(1, Math.round(ms.weight))),
      },
      taskIds,
    );
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (error) {
    console.error("milestones restore 실패:", error);
    return NextResponse.json({ error: "되돌리지 못했습니다" }, { status: 500 });
  }
}
