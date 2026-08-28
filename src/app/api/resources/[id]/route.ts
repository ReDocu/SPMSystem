import { NextResponse, type NextRequest } from "next/server";
import { isDbConfigured } from "@/lib/db";
import { isUuid } from "@/lib/ids";
import { deleteResource, updateResource } from "@/lib/resources/repo";

const MAX_TITLE = 500;
const MAX_TEXT = 20_000;

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!isDbConfigured()) return NextResponse.json({ error: "DB 미설정" }, { status: 503 });
  const { id } = await params;
  if (!isUuid(id)) return NextResponse.json({ error: "자료가 없습니다" }, { status: 404 });

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청 본문" }, { status: 400 });
  }

  const patch: Parameters<typeof updateResource>[1] = {};
  if (typeof body.title === "string" && body.title.trim()) {
    patch.title = body.title.trim().slice(0, MAX_TITLE);
  }
  if (body.memo !== undefined) {
    patch.memo = typeof body.memo === "string" ? body.memo.trim().slice(0, MAX_TEXT) || null : null;
  }
  if (body.content !== undefined) {
    patch.content =
      typeof body.content === "string" ? body.content.slice(0, MAX_TEXT) || null : null;
  }
  if (body.category !== undefined) {
    patch.category = typeof body.category === "string" ? body.category.slice(0, 50) : null;
  }
  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "변경할 내용이 없습니다" }, { status: 400 });
  }

  try {
    const item = await updateResource(id, patch);
    if (!item) return NextResponse.json({ error: "자료가 없습니다" }, { status: 404 });
    return NextResponse.json({ item });
  } catch (error) {
    console.error("resources PATCH 실패:", error);
    return NextResponse.json({ error: "수정하지 못했습니다" }, { status: 500 });
  }
}

// 즉시 삭제 — 삭제 행 반환으로 5초 되돌리기 지원
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!isDbConfigured()) return NextResponse.json({ error: "DB 미설정" }, { status: 503 });
  const { id } = await params;
  if (!isUuid(id)) return NextResponse.json({ error: "자료가 없습니다" }, { status: 404 });
  try {
    const item = await deleteResource(id);
    if (!item) return NextResponse.json({ error: "자료가 없습니다" }, { status: 404 });
    return NextResponse.json({ item });
  } catch (error) {
    console.error("resources DELETE 실패:", error);
    return NextResponse.json({ error: "삭제하지 못했습니다" }, { status: 500 });
  }
}
