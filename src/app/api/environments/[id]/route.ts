import { NextResponse, type NextRequest } from "next/server";
import { isDbConfigured } from "@/lib/db";
import { isUuid } from "@/lib/ids";
import { deleteEnvironment, updateEnvironment } from "@/lib/ops/repo";
import { parseEnvironmentInput } from "@/lib/ops/input";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!isDbConfigured()) return NextResponse.json({ error: "DB 미설정" }, { status: 503 });
  const { id } = await params;
  if (!isUuid(id)) return NextResponse.json({ error: "환경이 없습니다" }, { status: 404 });

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청 본문" }, { status: 400 });
  }
  const parsed = parseEnvironmentInput(body, false);
  if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });

  try {
    const item = await updateEnvironment(id, parsed.input);
    if (!item) return NextResponse.json({ error: "환경이 없습니다" }, { status: 404 });
    return NextResponse.json({ item });
  } catch (error) {
    console.error("environments PATCH 실패:", error);
    return NextResponse.json({ error: "수정하지 못했습니다" }, { status: 500 });
  }
}

// 즉시 삭제 — cascade되는 배포 이력까지 백업으로 돌려준다 (되돌리기가 진짜 되돌리기가 되도록)
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!isDbConfigured()) return NextResponse.json({ error: "DB 미설정" }, { status: 503 });
  const { id } = await params;
  if (!isUuid(id)) return NextResponse.json({ error: "환경이 없습니다" }, { status: 404 });

  try {
    const backup = await deleteEnvironment(id);
    if (!backup) return NextResponse.json({ error: "환경이 없습니다" }, { status: 404 });
    return NextResponse.json(backup);
  } catch (error) {
    console.error("environments DELETE 실패:", error);
    return NextResponse.json({ error: "삭제하지 못했습니다" }, { status: 500 });
  }
}
