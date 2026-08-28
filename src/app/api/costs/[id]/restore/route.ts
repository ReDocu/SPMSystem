import { NextResponse, type NextRequest } from "next/server";
import { isDbConfigured } from "@/lib/db";
import { isUuid } from "@/lib/ids";
import { restoreCost } from "@/lib/ops/repo";
import { parseCostFields } from "@/lib/ops/input";
import { isDateKey } from "@/lib/schedule/validate";
import type { Cost } from "@/lib/ops/model";

// 5초 되돌리기 — DELETE 응답 행 복원 (price_checked_at 포함)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!isDbConfigured()) return NextResponse.json({ error: "DB 미설정" }, { status: 503 });
  const { id } = await params;
  if (!isUuid(id)) return NextResponse.json({ error: "복원 대상이 없습니다" }, { status: 404 });

  let body: Partial<Cost>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청 본문" }, { status: 400 });
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  const fields = parseCostFields(body as Record<string, unknown>);
  if (!name || "error" in fields) {
    return NextResponse.json({ error: "복원 정보가 올바르지 않습니다" }, { status: 400 });
  }

  try {
    await restoreCost({
      id,
      name,
      ...fields,
      projectId: isUuid(body.projectId) ? body.projectId : null,
      platformId: isUuid(body.platformId) ? body.platformId : null,
      priceCheckedAt: isDateKey(body.priceCheckedAt) ? body.priceCheckedAt : null,
    });
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (error) {
    console.error("costs restore 실패:", error);
    return NextResponse.json({ error: "되돌리지 못했습니다" }, { status: 500 });
  }
}
