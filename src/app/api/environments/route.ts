import { NextResponse, type NextRequest } from "next/server";
import { isDbConfigured } from "@/lib/db";
import { isUuid } from "@/lib/ids";
import { createEnvironment, listEnvironments } from "@/lib/ops/repo";
import { parseEnvironmentInput } from "@/lib/ops/input";

export async function GET(request: NextRequest) {
  if (!isDbConfigured()) return NextResponse.json({ error: "DB 미설정" }, { status: 503 });
  const projectId = request.nextUrl.searchParams.get("projectId");
  try {
    const items = await listEnvironments(isUuid(projectId) ? projectId : undefined);
    return NextResponse.json({ items });
  } catch (error) {
    console.error("environments GET 실패:", error);
    return NextResponse.json({ error: "목록을 불러오지 못했습니다" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  if (!isDbConfigured()) return NextResponse.json({ error: "DB 미설정" }, { status: 503 });

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청 본문" }, { status: 400 });
  }
  const parsed = parseEnvironmentInput(body, true);
  if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });

  try {
    const item = await createEnvironment(parsed.input);
    if (!item) return NextResponse.json({ error: "프로젝트가 없습니다" }, { status: 404 });
    return NextResponse.json({ item }, { status: 201 });
  } catch (error) {
    console.error("environments POST 실패:", error);
    return NextResponse.json({ error: "저장하지 못했습니다" }, { status: 500 });
  }
}
