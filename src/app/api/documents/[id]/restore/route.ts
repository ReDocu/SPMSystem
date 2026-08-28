import { NextResponse, type NextRequest } from "next/server";
import { isDbConfigured } from "@/lib/db";
import { isUuid } from "@/lib/ids";
import { restoreDocument, type ProjectDocument } from "@/lib/projects/repo";

// 5초 되돌리기 — DELETE 응답 행을 그대로 복원
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!isDbConfigured()) return NextResponse.json({ error: "DB 미설정" }, { status: 503 });
  const { id } = await params;
  if (!isUuid(id)) return NextResponse.json({ error: "복원 대상이 없습니다" }, { status: 404 });

  let body: Partial<ProjectDocument>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청 본문" }, { status: 400 });
  }

  if (!isUuid(body.projectId) || typeof body.title !== "string" || typeof body.updatedAt !== "string") {
    return NextResponse.json({ error: "복원 정보가 올바르지 않습니다" }, { status: 400 });
  }

  try {
    const item = await restoreDocument({
      id,
      projectId: body.projectId,
      title: body.title,
      content: typeof body.content === "string" ? body.content : null,
      templateType: typeof body.templateType === "string" ? body.templateType : null,
      updatedAt: body.updatedAt,
    });
    return NextResponse.json({ item }, { status: 201 });
  } catch (error) {
    console.error("documents restore 실패:", error);
    return NextResponse.json({ error: "되돌리지 못했습니다" }, { status: 500 });
  }
}
