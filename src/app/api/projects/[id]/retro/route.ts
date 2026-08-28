import { NextResponse, type NextRequest } from "next/server";
import { isDbConfigured } from "@/lib/db";
import { isUuid } from "@/lib/ids";
import { getProject, upsertRetro } from "@/lib/projects/repo";
import { parseRetroFields } from "@/lib/projects/retro-input";

// 회고 탭에서 작성·수정 — 종료(completed/dropped) 상태에서만 (§5.4)
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!isDbConfigured()) return NextResponse.json({ error: "DB 미설정" }, { status: 503 });
  const { id } = await params;
  if (!isUuid(id)) return NextResponse.json({ error: "프로젝트가 없습니다" }, { status: 404 });

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청 본문" }, { status: 400 });
  }

  try {
    const project = await getProject(id);
    if (!project) return NextResponse.json({ error: "프로젝트가 없습니다" }, { status: 404 });
    if (project.status !== "completed" && project.status !== "dropped") {
      return NextResponse.json({ error: "프로젝트를 마친 뒤에 작성할 수 있습니다" }, { status: 409 });
    }
    const item = await upsertRetro(id, parseRetroFields(body));
    return NextResponse.json({ item });
  } catch (error) {
    console.error("retro PUT 실패:", error);
    return NextResponse.json({ error: "저장하지 못했습니다" }, { status: 500 });
  }
}
