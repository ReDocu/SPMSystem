import { NextResponse, type NextRequest } from "next/server";
import { isDbConfigured } from "@/lib/db";
import { isUuid } from "@/lib/ids";
import { deleteDocument, updateDocument } from "@/lib/projects/repo";

const MAX_CONTENT = 100_000;

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!isDbConfigured()) return NextResponse.json({ error: "DB 미설정" }, { status: 503 });
  const { id } = await params;
  if (!isUuid(id)) return NextResponse.json({ error: "문서가 없습니다" }, { status: 404 });

  let body: { title?: unknown; content?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청 본문" }, { status: 400 });
  }

  const patch: { title?: string; content?: string | null } = {};
  if (typeof body.title === "string" && body.title.trim()) {
    patch.title = body.title.trim().slice(0, 200);
  }
  if (body.content !== undefined) {
    patch.content =
      typeof body.content === "string" ? body.content.slice(0, MAX_CONTENT) || null : null;
  }
  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "변경할 내용이 없습니다" }, { status: 400 });
  }

  try {
    const item = await updateDocument(id, patch);
    if (!item) return NextResponse.json({ error: "문서가 없습니다" }, { status: 404 });
    return NextResponse.json({ item });
  } catch (error) {
    console.error("documents PATCH 실패:", error);
    return NextResponse.json({ error: "수정하지 못했습니다" }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!isDbConfigured()) return NextResponse.json({ error: "DB 미설정" }, { status: 503 });
  const { id } = await params;
  if (!isUuid(id)) return NextResponse.json({ error: "문서가 없습니다" }, { status: 404 });

  try {
    const item = await deleteDocument(id);
    if (!item) return NextResponse.json({ error: "문서가 없습니다" }, { status: 404 });
    return NextResponse.json({ item });
  } catch (error) {
    console.error("documents DELETE 실패:", error);
    return NextResponse.json({ error: "삭제하지 못했습니다" }, { status: 500 });
  }
}
