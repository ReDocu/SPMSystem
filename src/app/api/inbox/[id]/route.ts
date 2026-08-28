import { NextResponse } from "next/server";
import { isDbConfigured } from "@/lib/db";
import { deleteItem } from "@/lib/inbox/repo";

// 즉시 삭제 (확인 모달 금지) — 삭제된 행을 돌려줘 클라이언트가 5초 되돌리기에 쓴다
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!isDbConfigured()) return NextResponse.json({ error: "DB 미설정" }, { status: 503 });
  const { id } = await params;

  try {
    const item = await deleteItem(id);
    if (!item) return NextResponse.json({ error: "항목이 없습니다" }, { status: 404 });
    return NextResponse.json({ item });
  } catch (error) {
    console.error("inbox DELETE 실패:", error);
    return NextResponse.json({ error: "삭제하지 못했습니다" }, { status: 500 });
  }
}
