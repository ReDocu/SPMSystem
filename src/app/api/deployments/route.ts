import { NextResponse, type NextRequest } from "next/server";
import { isDbConfigured } from "@/lib/db";
import { isUuid } from "@/lib/ids";
import { createDeployment, listDeployments } from "@/lib/ops/repo";
import type { ChecklistItem } from "@/lib/ops/model";

function parseChecklist(value: unknown): ChecklistItem[] | null {
  if (!Array.isArray(value)) return null;
  return value
    .filter((c): c is Record<string, unknown> => Boolean(c) && typeof c === "object")
    .map((c) => ({
      item: typeof c.item === "string" ? c.item.slice(0, 200) : "",
      checked: c.checked === true,
    }))
    .filter((c) => c.item)
    .slice(0, 30);
}

export async function GET() {
  if (!isDbConfigured()) return NextResponse.json({ error: "DB 미설정" }, { status: 503 });
  try {
    return NextResponse.json({ items: await listDeployments() });
  } catch (error) {
    console.error("deployments GET 실패:", error);
    return NextResponse.json({ error: "목록을 불러오지 못했습니다" }, { status: 500 });
  }
}

// 배포 기록 — 체크 결과는 스냅샷으로 저장 (템플릿이 바뀌어도 그때 확인한 내용은 남는다, §7.2)
export async function POST(request: NextRequest) {
  if (!isDbConfigured()) return NextResponse.json({ error: "DB 미설정" }, { status: 503 });

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청 본문" }, { status: 400 });
  }

  if (!isUuid(body.environmentId)) {
    return NextResponse.json({ error: "환경이 올바르지 않습니다" }, { status: 400 });
  }
  const version = typeof body.version === "string" ? body.version.trim().slice(0, 100) : "";
  if (!version) return NextResponse.json({ error: "버전이 비어 있습니다" }, { status: 400 });

  try {
    const item = await createDeployment({
      environmentId: body.environmentId,
      version,
      changelog: typeof body.changelog === "string" ? body.changelog.trim().slice(0, 5000) || null : null,
      checklist: parseChecklist(body.checklist),
    });
    if (!item) return NextResponse.json({ error: "환경이 없습니다" }, { status: 404 });
    return NextResponse.json({ item }, { status: 201 });
  } catch (error) {
    console.error("deployments POST 실패:", error);
    return NextResponse.json({ error: "저장하지 못했습니다" }, { status: 500 });
  }
}
