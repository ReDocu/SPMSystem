import { NextResponse, type NextRequest } from "next/server";
import { isDbConfigured } from "@/lib/db";
import {
  createIdea,
  createSite,
  fetchPageMeta,
  listResources,
  type ResourceType,
} from "@/lib/resources/repo";

const MAX_TITLE = 500;
const MAX_TEXT = 20_000;

function isHttpUrl(value: unknown): value is string {
  if (typeof value !== "string") return false;
  try {
    const u = new URL(value);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

export async function GET(request: NextRequest) {
  if (!isDbConfigured()) return NextResponse.json({ error: "DB 미설정" }, { status: 503 });
  const params = request.nextUrl.searchParams;
  const type = params.get("type");
  try {
    const items = await listResources({
      type: type === "site" || type === "idea" ? (type as ResourceType) : undefined,
      category: params.get("category") ?? undefined,
      search: params.get("q")?.trim() || undefined,
    });
    return NextResponse.json({ items });
  } catch (error) {
    console.error("resources GET 실패:", error);
    return NextResponse.json({ error: "목록을 불러오지 못했습니다" }, { status: 500 });
  }
}

// 사이트: url 필수, 제목·썸네일은 서버가 og 메타로 자동 채움 / 아이디어: title 또는 content
export async function POST(request: NextRequest) {
  if (!isDbConfigured()) return NextResponse.json({ error: "DB 미설정" }, { status: 503 });

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청 본문" }, { status: 400 });
  }

  try {
    if (body.type === "site") {
      if (!isHttpUrl(body.url)) {
        return NextResponse.json({ error: "URL이 올바르지 않습니다" }, { status: 400 });
      }
      const memo = typeof body.memo === "string" ? body.memo.trim().slice(0, MAX_TEXT) : null;
      const category = typeof body.category === "string" ? body.category.slice(0, 50) : null;
      const meta = await fetchPageMeta(body.url);
      const item = await createSite({
        url: body.url,
        title: meta.title.slice(0, MAX_TITLE),
        thumbnail: meta.thumbnail ?? null,
        memo: memo || null,
        category,
      });
      return NextResponse.json({ item }, { status: 201 });
    }

    if (body.type === "idea") {
      const content = typeof body.content === "string" ? body.content.trim().slice(0, MAX_TEXT) : "";
      const title =
        (typeof body.title === "string" ? body.title.trim().slice(0, MAX_TITLE) : "") ||
        content.split("\n")[0]?.slice(0, 80);
      if (!title) return NextResponse.json({ error: "내용이 비어 있습니다" }, { status: 400 });
      const item = await createIdea({ title, content: content || null });
      return NextResponse.json({ item }, { status: 201 });
    }

    return NextResponse.json({ error: "type은 site 또는 idea여야 합니다" }, { status: 400 });
  } catch (error) {
    console.error("resources POST 실패:", error);
    return NextResponse.json({ error: "저장하지 못했습니다" }, { status: 500 });
  }
}
