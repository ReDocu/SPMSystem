import { NextResponse, type NextRequest } from "next/server";
import { isDbConfigured } from "@/lib/db";
import { isUuid } from "@/lib/ids";
import { deleteCost, recheckCost } from "@/lib/ops/repo";
import { parseCostFields } from "@/lib/ops/input";

// 재확인 — 가격 갱신 + price_checked_at 오늘 (신선도 리셋, O4)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!isDbConfigured()) return NextResponse.json({ error: "DB 미설정" }, { status: 503 });
  const { id } = await params;
  if (!isUuid(id)) return NextResponse.json({ error: "비용 항목이 없습니다" }, { status: 404 });

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청 본문" }, { status: 400 });
  }
  const fields = parseCostFields(body);
  if ("error" in fields) return NextResponse.json({ error: fields.error }, { status: 400 });

  try {
    const item = await recheckCost(id, fields);
    if (!item) return NextResponse.json({ error: "비용 항목이 없습니다" }, { status: 404 });
    return NextResponse.json({ item });
  } catch (error) {
    console.error("costs PATCH 실패:", error);
    return NextResponse.json({ error: "수정하지 못했습니다" }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!isDbConfigured()) return NextResponse.json({ error: "DB 미설정" }, { status: 503 });
  const { id } = await params;
  if (!isUuid(id)) return NextResponse.json({ error: "비용 항목이 없습니다" }, { status: 404 });

  try {
    const item = await deleteCost(id);
    if (!item) return NextResponse.json({ error: "비용 항목이 없습니다" }, { status: 404 });
    return NextResponse.json({ item });
  } catch (error) {
    console.error("costs DELETE 실패:", error);
    return NextResponse.json({ error: "삭제하지 못했습니다" }, { status: 500 });
  }
}
