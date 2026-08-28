import { NextResponse } from "next/server";
import { isDbConfigured } from "@/lib/db";
import { processAll } from "@/lib/inbox/repo";

// "모두 처리 완료" — 남은 항목 전부 처리 표시 (전환 없이 비우기)
export async function POST() {
  if (!isDbConfigured()) return NextResponse.json({ error: "DB 미설정" }, { status: 503 });

  try {
    const processed = await processAll();
    return NextResponse.json({ processed });
  } catch (error) {
    console.error("inbox process-all 실패:", error);
    return NextResponse.json({ error: "처리하지 못했습니다" }, { status: 500 });
  }
}
