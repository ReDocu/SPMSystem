import { NextResponse, type NextRequest } from "next/server";
import { isDbConfigured } from "@/lib/db";
import { isUuid } from "@/lib/ids";
import { setRolledBack } from "@/lib/ops/repo";

// 롤백 표시 토글 — 기록은 지우지 않는다
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!isDbConfigured()) return NextResponse.json({ error: "DB 미설정" }, { status: 503 });
  const { id } = await params;
  if (!isUuid(id)) return NextResponse.json({ error: "배포 기록이 없습니다" }, { status: 404 });

  let body: { rolledBack?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청 본문" }, { status: 400 });
  }
  if (typeof body.rolledBack !== "boolean") {
    return NextResponse.json({ error: "변경할 내용이 없습니다" }, { status: 400 });
  }

  try {
    const ok = await setRolledBack(id, body.rolledBack);
    if (!ok) return NextResponse.json({ error: "배포 기록이 없습니다" }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("deployments PATCH 실패:", error);
    return NextResponse.json({ error: "수정하지 못했습니다" }, { status: 500 });
  }
}
