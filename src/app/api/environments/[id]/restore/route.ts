import { NextResponse, type NextRequest } from "next/server";
import { isDbConfigured } from "@/lib/db";
import { isUuid } from "@/lib/ids";
import { restoreEnvironment } from "@/lib/ops/repo";
import { parseEnvironmentInput } from "@/lib/ops/input";
import type { ChecklistItem, EnvironmentBackup } from "@/lib/ops/model";

function parseDeployments(value: unknown): EnvironmentBackup["deployments"] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((d): d is Record<string, unknown> => Boolean(d) && typeof d === "object")
    .filter((d) => isUuid(d.id) && typeof d.version === "string" && typeof d.deployedAt === "string")
    .map((d) => ({
      id: d.id as string,
      version: (d.version as string).slice(0, 100),
      deployedAt: d.deployedAt as string,
      changelog: typeof d.changelog === "string" ? d.changelog : null,
      rolledBack: d.rolledBack === true,
      checklistSnapshot: Array.isArray(d.checklistSnapshot)
        ? (d.checklistSnapshot as ChecklistItem[])
        : null,
    }))
    .slice(0, 200);
}

// 5초 되돌리기 — 환경 + cascade됐던 배포 이력을 함께 복원
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!isDbConfigured()) return NextResponse.json({ error: "DB 미설정" }, { status: 503 });
  const { id } = await params;
  if (!isUuid(id)) return NextResponse.json({ error: "복원 대상이 없습니다" }, { status: 404 });

  let body: { environment?: Record<string, unknown>; deployments?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청 본문" }, { status: 400 });
  }

  if (!body.environment || typeof body.environment !== "object") {
    return NextResponse.json({ error: "복원 정보가 올바르지 않습니다" }, { status: 400 });
  }
  const parsed = parseEnvironmentInput(body.environment, true);
  if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });

  try {
    await restoreEnvironment({
      environment: {
        id,
        projectId: parsed.input.projectId,
        name: parsed.input.name,
        platformId: parsed.input.platformId ?? null,
        host: parsed.input.host ?? null,
        domain: parsed.input.domain ?? null,
        sslExpiresAt: parsed.input.sslExpiresAt ?? null,
        secrets: parsed.input.secrets ?? [],
      },
      deployments: parseDeployments(body.deployments),
    });
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (error) {
    console.error("environments restore 실패:", error);
    return NextResponse.json({ error: "되돌리지 못했습니다" }, { status: 500 });
  }
}
