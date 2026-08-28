import { NextResponse, type NextRequest } from "next/server";
import { isDbConfigured } from "@/lib/db";
import { restoreItem, type InboxItem, type InboxSource } from "@/lib/inbox/repo";

const SOURCES: InboxSource[] = ["web", "bookmarklet", "mobile"];

// 5초 되돌리기 — DELETE 응답으로 받은 행을 원래 id·시각 그대로 되살린다
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!isDbConfigured()) return NextResponse.json({ error: "DB 미설정" }, { status: 503 });
  const { id } = await params;

  let body: Partial<InboxItem>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청 본문" }, { status: 400 });
  }

  if (
    typeof body.rawText !== "string" ||
    !body.rawText.trim() ||
    typeof body.guessedType !== "string" ||
    typeof body.createdAt !== "string" ||
    !SOURCES.includes(body.source as InboxSource)
  ) {
    return NextResponse.json({ error: "복원 정보가 올바르지 않습니다" }, { status: 400 });
  }

  try {
    const item = await restoreItem({
      id,
      rawText: body.rawText,
      source: body.source as InboxSource,
      guessedType: body.guessedType,
      createdAt: body.createdAt,
    });
    return NextResponse.json({ item }, { status: 201 });
  } catch (error) {
    console.error("inbox restore 실패:", error);
    return NextResponse.json({ error: "되돌리지 못했습니다" }, { status: 500 });
  }
}
