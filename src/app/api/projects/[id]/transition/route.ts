import { NextResponse, type NextRequest } from "next/server";
import { isDbConfigured } from "@/lib/db";
import { isUuid } from "@/lib/ids";
import { transitionProject } from "@/lib/projects/repo";
import { parseProjectPatch } from "@/lib/projects/patch";
import type { ProjectStatus } from "@/lib/projects/model";

const STATUSES: ProjectStatus[] = ["idea", "planning", "active", "live", "paused", "completed", "dropped"];

// 게이트 전이 — 소프트 강제: 게이트 필드(patch)는 채워도, 건너뛰어도 전이된다 (§2.2)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!isDbConfigured()) return NextResponse.json({ error: "DB 미설정" }, { status: 503 });
  const { id } = await params;
  if (!isUuid(id)) return NextResponse.json({ error: "프로젝트가 없습니다" }, { status: 404 });

  let body: { to?: unknown; patch?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청 본문" }, { status: 400 });
  }

  if (!STATUSES.includes(body.to as ProjectStatus)) {
    return NextResponse.json({ error: "상태가 올바르지 않습니다" }, { status: 400 });
  }
  const patch =
    body.patch && typeof body.patch === "object"
      ? parseProjectPatch(body.patch as Record<string, unknown>)
      : {};

  try {
    const result = await transitionProject(id, body.to as ProjectStatus, patch);
    if (result === null) return NextResponse.json({ error: "프로젝트가 없습니다" }, { status: 404 });
    if (result === "invalid") {
      return NextResponse.json({ error: "허용되지 않는 전이입니다" }, { status: 409 });
    }
    return NextResponse.json({ item: result });
  } catch (error) {
    console.error("projects transition 실패:", error);
    return NextResponse.json({ error: "전이하지 못했습니다" }, { status: 500 });
  }
}
