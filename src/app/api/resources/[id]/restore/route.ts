import { NextResponse, type NextRequest } from "next/server";
import { isDbConfigured } from "@/lib/db";
import { isUuid } from "@/lib/ids";
import { restoreResource, type Resource } from "@/lib/resources/repo";

// 5초 되돌리기 — DELETE 응답 행을 원래 id·시각 그대로 복원
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!isDbConfigured()) return NextResponse.json({ error: "DB 미설정" }, { status: 503 });
  const { id } = await params;
  if (!isUuid(id)) return NextResponse.json({ error: "복원 대상이 없습니다" }, { status: 404 });

  let body: Partial<Resource>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청 본문" }, { status: 400 });
  }

  if (
    (body.type !== "site" && body.type !== "idea") ||
    typeof body.title !== "string" ||
    typeof body.createdAt !== "string"
  ) {
    return NextResponse.json({ error: "복원 정보가 올바르지 않습니다" }, { status: 400 });
  }

  try {
    const item = await restoreResource({
      id,
      type: body.type,
      url: typeof body.url === "string" ? body.url : null,
      title: body.title,
      memo: typeof body.memo === "string" ? body.memo : null,
      content: typeof body.content === "string" ? body.content : null,
      thumbnail: typeof body.thumbnail === "string" ? body.thumbnail : null,
      category: typeof body.category === "string" ? body.category : null,
      createdAt: body.createdAt,
    });
    return NextResponse.json({ item }, { status: 201 });
  } catch (error) {
    console.error("resources restore 실패:", error);
    return NextResponse.json({ error: "되돌리지 못했습니다" }, { status: 500 });
  }
}
