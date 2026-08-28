import { NextResponse, type NextRequest } from "next/server";
import { isDbConfigured } from "@/lib/db";
import { isUuid } from "@/lib/ids";
import { createDocument } from "@/lib/projects/repo";
import { DOC_TEMPLATES } from "@/lib/projects/templates";

// 새 문서 — 템플릿 4종 또는 빈 문서 (상세기획 §5.3)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!isDbConfigured()) return NextResponse.json({ error: "DB 미설정" }, { status: 503 });
  const { id } = await params;
  if (!isUuid(id)) return NextResponse.json({ error: "프로젝트가 없습니다" }, { status: 404 });

  let body: { template?: unknown; title?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청 본문" }, { status: 400 });
  }

  const template =
    typeof body.template === "string" && body.template in DOC_TEMPLATES ? body.template : null;
  const title =
    (typeof body.title === "string" ? body.title.trim().slice(0, 200) : "") ||
    (template ? DOC_TEMPLATES[template].label : "새 문서");

  try {
    const item = await createDocument(id, {
      title,
      content: template ? DOC_TEMPLATES[template].content : null,
      templateType: template,
    });
    return NextResponse.json({ item }, { status: 201 });
  } catch (error) {
    console.error("documents POST 실패:", error);
    return NextResponse.json({ error: "저장하지 못했습니다" }, { status: 500 });
  }
}
