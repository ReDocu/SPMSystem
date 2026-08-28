import { NextResponse, type NextRequest } from "next/server";
import { isDbConfigured } from "@/lib/db";
import { isUuid } from "@/lib/ids";
import { createProjectTask } from "@/lib/projects/repo";
import { isDateKey } from "@/lib/schedule/validate";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!isDbConfigured()) return NextResponse.json({ error: "DB 미설정" }, { status: 503 });
  const { id } = await params;
  if (!isUuid(id)) return NextResponse.json({ error: "프로젝트가 없습니다" }, { status: 404 });

  let body: { title?: unknown; milestoneId?: unknown; dueDate?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청 본문" }, { status: 400 });
  }

  const title = typeof body.title === "string" ? body.title.trim().slice(0, 300) : "";
  if (!title) return NextResponse.json({ error: "제목이 비어 있습니다" }, { status: 400 });
  if (body.milestoneId != null && !isUuid(body.milestoneId)) {
    return NextResponse.json({ error: "마일스톤이 올바르지 않습니다" }, { status: 400 });
  }
  if (body.dueDate != null && !isDateKey(body.dueDate)) {
    return NextResponse.json({ error: "마감일이 올바르지 않습니다" }, { status: 400 });
  }

  try {
    const item = await createProjectTask(id, {
      title,
      milestoneId: (body.milestoneId as string | null | undefined) ?? null,
      dueDate: (body.dueDate as string | null | undefined) ?? null,
    });
    return NextResponse.json({ item }, { status: 201 });
  } catch (error) {
    console.error("project tasks POST 실패:", error);
    return NextResponse.json({ error: "저장하지 못했습니다" }, { status: 500 });
  }
}
