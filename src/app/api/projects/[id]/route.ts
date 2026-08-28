import { NextResponse, type NextRequest } from "next/server";
import { isDbConfigured } from "@/lib/db";
import { isUuid } from "@/lib/ids";
import { updateProject } from "@/lib/projects/repo";
import { parseProjectPatch } from "@/lib/projects/patch";

// 개요 필드 수정 — 게이트에서 건너뛴 빈칸을 나중에 채우는 경로 (§2.2)
export async function PATCH(
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

  const patch = parseProjectPatch(body);
  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "변경할 내용이 없습니다" }, { status: 400 });
  }

  try {
    const item = await updateProject(id, patch);
    if (!item) return NextResponse.json({ error: "프로젝트가 없습니다" }, { status: 404 });
    return NextResponse.json({ item });
  } catch (error) {
    console.error("projects PATCH 실패:", error);
    return NextResponse.json({ error: "수정하지 못했습니다" }, { status: 500 });
  }
}
