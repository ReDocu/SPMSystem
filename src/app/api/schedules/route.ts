import { NextResponse, type NextRequest } from "next/server";
import { isDbConfigured } from "@/lib/db";
import { createEvent } from "@/lib/schedule/events";
import { parseEventInput } from "@/lib/schedule/event-input";

export async function POST(request: NextRequest) {
  if (!isDbConfigured()) return NextResponse.json({ error: "DB 미설정" }, { status: 503 });

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청 본문" }, { status: 400 });
  }

  const parsed = parseEventInput(body);
  if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });

  try {
    const item = await createEvent(parsed.input);
    return NextResponse.json({ item }, { status: 201 });
  } catch (error) {
    console.error("schedules POST 실패:", error);
    return NextResponse.json({ error: "저장하지 못했습니다" }, { status: 500 });
  }
}
