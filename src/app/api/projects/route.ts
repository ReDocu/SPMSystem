import { NextResponse, type NextRequest } from "next/server";
import { isDbConfigured } from "@/lib/db";
import { createProject, listProjectCards } from "@/lib/projects/repo";

const MAX_TITLE = 200;

export async function GET() {
  if (!isDbConfigured()) return NextResponse.json({ error: "DB 미설정" }, { status: 503 });
  try {
    return NextResponse.json({ items: await listProjectCards() });
  } catch (error) {
    console.error("projects GET 실패:", error);
    return NextResponse.json({ error: "목록을 불러오지 못했습니다" }, { status: 500 });
  }
}

// G0 씨앗 — 제목(유일한 필수) + 한 줄 메모 (상세기획 §2.1)
export async function POST(request: NextRequest) {
  if (!isDbConfigured()) return NextResponse.json({ error: "DB 미설정" }, { status: 503 });

  let body: { title?: unknown; description?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청 본문" }, { status: 400 });
  }

  const title = typeof body.title === "string" ? body.title.trim() : "";
  if (!title || title.length > MAX_TITLE) {
    return NextResponse.json({ error: "제목이 비었거나 너무 깁니다" }, { status: 400 });
  }
  const description =
    typeof body.description === "string" ? body.description.trim().slice(0, 2000) || null : null;

  try {
    const item = await createProject(title, description);
    return NextResponse.json({ item }, { status: 201 });
  } catch (error) {
    console.error("projects POST 실패:", error);
    return NextResponse.json({ error: "저장하지 못했습니다" }, { status: 500 });
  }
}
