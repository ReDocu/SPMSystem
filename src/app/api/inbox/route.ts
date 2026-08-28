import { NextResponse, type NextRequest } from "next/server";
import { isDbConfigured } from "@/lib/db";
import { countUnprocessed, createItem, listUnprocessed, type InboxSource } from "@/lib/inbox/repo";

const MAX_CAPTURE_LENGTH = 10_000;
const SOURCES: InboxSource[] = ["web", "bookmarklet", "mobile"];

export async function GET() {
  if (!isDbConfigured()) return NextResponse.json({ error: "DB 미설정" }, { status: 503 });
  try {
    const [items, count] = await Promise.all([listUnprocessed(), countUnprocessed()]);
    return NextResponse.json({ items, count });
  } catch (error) {
    console.error("inbox GET 실패:", error);
    return NextResponse.json({ error: "인박스를 불러오지 못했습니다" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  if (!isDbConfigured()) return NextResponse.json({ error: "DB 미설정" }, { status: 503 });

  let body: { text?: unknown; source?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청 본문" }, { status: 400 });
  }

  const text = typeof body.text === "string" ? body.text.trim() : "";
  if (!text) return NextResponse.json({ error: "내용이 비어 있습니다" }, { status: 400 });
  if (text.length > MAX_CAPTURE_LENGTH) {
    return NextResponse.json({ error: "내용이 너무 깁니다" }, { status: 400 });
  }
  const source = SOURCES.includes(body.source as InboxSource)
    ? (body.source as InboxSource)
    : "web";

  try {
    const item = await createItem(text, source);
    return NextResponse.json({ item }, { status: 201 });
  } catch (error) {
    console.error("inbox POST 실패:", error);
    return NextResponse.json({ error: "저장하지 못했습니다" }, { status: 500 });
  }
}
