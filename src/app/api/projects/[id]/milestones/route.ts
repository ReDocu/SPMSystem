import { NextResponse, type NextRequest } from "next/server";
import { isDbConfigured } from "@/lib/db";
import { isUuid } from "@/lib/ids";
import { createMilestone } from "@/lib/projects/repo";
import { isDateKey } from "@/lib/schedule/validate";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!isDbConfigured()) return NextResponse.json({ error: "DB 미설정" }, { status: 503 });
  const { id } = await params;
  if (!isUuid(id)) return NextResponse.json({ error: "프로젝트가 없습니다" }, { status: 404 });

  let body: { title?: unknown; dueDate?: unknown; weight?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청 본문" }, { status: 400 });
  }

  const title = typeof body.title === "string" ? body.title.trim().slice(0, 200) : "";
  if (!title) return NextResponse.json({ error: "제목이 비어 있습니다" }, { status: 400 });
  if (body.dueDate != null && !isDateKey(body.dueDate)) {
    return NextResponse.json({ error: "마감일이 올바르지 않습니다" }, { status: 400 });
  }
  const weight = typeof body.weight === "number" && body.weight >= 1 && body.weight <= 10
    ? Math.round(body.weight)
    : 1;

  try {
    const item = await createMilestone(id, {
      title,
      dueDate: (body.dueDate as string | null | undefined) ?? null,
      weight,
    });
    return NextResponse.json({ item }, { status: 201 });
  } catch (error) {
    console.error("milestones POST 실패:", error);
    return NextResponse.json({ error: "저장하지 못했습니다" }, { status: 500 });
  }
}
