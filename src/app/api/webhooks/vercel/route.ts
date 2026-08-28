import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { getPool, isDbConfigured } from "@/lib/db";
import { getUserId } from "@/lib/user";

interface VercelPayload {
  type?: string;
  payload?: {
    deployment?: { meta?: Record<string, string> };
    project?: { name?: string };
  };
}

function verifySignature(rawBody: string, signature: string | null, secret: string): boolean {
  if (!signature) return false;
  const expected = createHmac("sha1", secret).update(rawBody).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Vercel 배포 Webhook 반자동 기록 (상세기획 §7.3) — 수동 입력만 있으면 3번쯤 하다 안 하게 된다.
 * deployment.succeeded → 프로젝트 이름 매칭 → prod 환경(없으면 생성)에 INSERT,
 * 커밋 메시지가 changelog 초안이 된다. SPM_VERCEL_WEBHOOK_SECRET 필수.
 */
export async function POST(request: NextRequest) {
  const secret = process.env.SPM_VERCEL_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "SPM_VERCEL_WEBHOOK_SECRET을 설정해야 사용할 수 있습니다" },
      { status: 503 },
    );
  }
  if (!isDbConfigured()) return NextResponse.json({ error: "DB 미설정" }, { status: 503 });

  const rawBody = await request.text();
  if (!verifySignature(rawBody, request.headers.get("x-vercel-signature"), secret)) {
    return NextResponse.json({ error: "서명이 올바르지 않습니다" }, { status: 401 });
  }

  let body: VercelPayload;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "잘못된 요청 본문" }, { status: 400 });
  }
  if (body.type !== "deployment.succeeded") {
    return NextResponse.json({ ignored: body.type ?? "unknown" });
  }

  const projectName = body.payload?.project?.name?.trim();
  if (!projectName) return NextResponse.json({ error: "프로젝트 이름이 없습니다" }, { status: 400 });
  const meta = body.payload?.deployment?.meta ?? {};
  const version = (meta.githubCommitSha ?? "").slice(0, 7) || "vercel";
  const changelog = meta.githubCommitMessage?.slice(0, 5000) ?? null;

  try {
    const userId = await getUserId();
    const pool = getPool();
    const project = await pool.query<{ id: string }>(
      "select id from projects where user_id = $1 and lower(title) = lower($2) limit 1",
      [userId, projectName],
    );
    if (project.rows.length === 0) {
      return NextResponse.json({ error: `프로젝트 '${projectName}'을 찾지 못했습니다` }, { status: 404 });
    }
    const projectId = project.rows[0].id;
    // prod 환경이 없으면 자동 생성 — staging만 있는 프로젝트에 prod 배포가 섞이면 안 된다
    const env = await pool.query<{ id: string }>(
      `insert into environments (user_id, project_id, name)
       select $1, $2, 'prod'
       where not exists (
         select 1 from environments where user_id = $1 and project_id = $2 and name = 'prod'
       )
       returning id`,
      [userId, projectId],
    );
    const envId =
      env.rows[0]?.id ??
      (
        await pool.query<{ id: string }>(
          `select id from environments
           where user_id = $1 and project_id = $2 and name = 'prod' limit 1`,
          [userId, projectId],
        )
      ).rows[0].id;
    const inserted = await pool.query<{ id: string }>(
      `insert into deployments (user_id, environment_id, version, changelog)
       values ($1, $2, $3, $4) returning id`,
      [userId, envId, version, changelog],
    );
    return NextResponse.json({ deploymentId: inserted.rows[0].id }, { status: 201 });
  } catch (error) {
    console.error("vercel webhook 실패:", error);
    return NextResponse.json({ error: "기록하지 못했습니다" }, { status: 500 });
  }
}
