import { NextResponse } from "next/server";
import { isDbConfigured } from "@/lib/db";
import { countUnprocessed } from "@/lib/inbox/repo";

// 메인 런처 4타일 데이터를 한 번에 반환한다 (기획서 §8.3). v0.1: 일정 타일만 실데이터 예정
export async function GET() {
  const inboxCount = isDbConfigured() ? await countUnprocessed().catch(() => 0) : 0;
  return NextResponse.json({
    schedule: { remainingToday: 0, nextEvent: null },
    projects: null, // v0.3
    ops: null, // v0.5
    resources: null, // v0.2
    inboxCount,
  });
}
