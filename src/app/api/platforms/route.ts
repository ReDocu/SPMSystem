import { NextResponse, type NextRequest } from "next/server";
import { isDbConfigured } from "@/lib/db";
import { createPlatform, listPlatforms } from "@/lib/ops/repo";
import { PLATFORM_CATEGORIES, type PlatformCategory } from "@/lib/ops/model";

function optionalUrl(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  try {
    const u = new URL(value);
    return u.protocol === "http:" || u.protocol === "https:" ? value : null;
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  if (!isDbConfigured()) return NextResponse.json({ error: "DB 미설정" }, { status: 503 });
  const category = request.nextUrl.searchParams.get("category");
  try {
    const items = await listPlatforms(
      PLATFORM_CATEGORIES.includes(category as PlatformCategory)
        ? (category as PlatformCategory)
        : undefined,
    );
    return NextResponse.json({ items });
  } catch (error) {
    console.error("platforms GET 실패:", error);
    return NextResponse.json({ error: "목록을 불러오지 못했습니다" }, { status: 500 });
  }
}

// 직접 추가 (is_custom) — 시드처럼 카탈로그에 나란히 선다 (§3.2)
export async function POST(request: NextRequest) {
  if (!isDbConfigured()) return NextResponse.json({ error: "DB 미설정" }, { status: 503 });

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청 본문" }, { status: 400 });
  }

  const name = typeof body.name === "string" ? body.name.trim().slice(0, 100) : "";
  if (!name) return NextResponse.json({ error: "이름이 비어 있습니다" }, { status: 400 });
  if (!PLATFORM_CATEGORIES.includes(body.category as PlatformCategory)) {
    return NextResponse.json({ error: "카테고리가 올바르지 않습니다" }, { status: 400 });
  }

  try {
    const item = await createPlatform({
      name,
      category: body.category as PlatformCategory,
      homepageUrl: optionalUrl(body.homepageUrl),
      pricingUrl: optionalUrl(body.pricingUrl),
      freeTierNote: typeof body.freeTierNote === "string" ? body.freeTierNote.trim().slice(0, 300) || null : null,
    });
    return NextResponse.json({ item }, { status: 201 });
  } catch (error) {
    console.error("platforms POST 실패:", error);
    return NextResponse.json({ error: "저장하지 못했습니다" }, { status: 500 });
  }
}
