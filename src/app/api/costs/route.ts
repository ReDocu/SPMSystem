import { NextResponse, type NextRequest } from "next/server";
import { isDbConfigured } from "@/lib/db";
import { isUuid } from "@/lib/ids";
import { createCost, listCosts } from "@/lib/ops/repo";
import { parseCostFields } from "@/lib/ops/input";

export async function GET() {
  if (!isDbConfigured()) return NextResponse.json({ error: "DB 미설정" }, { status: 503 });
  try {
    return NextResponse.json({ items: await listCosts() });
  } catch (error) {
    console.error("costs GET 실패:", error);
    return NextResponse.json({ error: "목록을 불러오지 못했습니다" }, { status: 500 });
  }
}

// 가격 체크 ③ [확인] — 저장하면 price_checked_at이 오늘로 기록된다 (O1)
export async function POST(request: NextRequest) {
  if (!isDbConfigured()) return NextResponse.json({ error: "DB 미설정" }, { status: 503 });

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청 본문" }, { status: 400 });
  }

  const name = typeof body.name === "string" ? body.name.trim().slice(0, 200) : "";
  if (!name) return NextResponse.json({ error: "이름이 비어 있습니다" }, { status: 400 });
  const fields = parseCostFields(body);
  if ("error" in fields) return NextResponse.json({ error: fields.error }, { status: 400 });

  try {
    const item = await createCost({
      name,
      ...fields,
      platformId: isUuid(body.platformId) ? (body.platformId as string) : null,
      projectId: isUuid(body.projectId) ? (body.projectId as string) : null,
    });
    return NextResponse.json({ item }, { status: 201 });
  } catch (error) {
    console.error("costs POST 실패:", error);
    return NextResponse.json({ error: "저장하지 못했습니다" }, { status: 500 });
  }
}
