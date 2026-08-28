import { NextResponse } from "next/server";
import { isDbConfigured } from "@/lib/db";
import { countUnprocessed } from "@/lib/inbox/repo";
import { resourceTileCounts } from "@/lib/resources/repo";

// 메인 런처 4타일 데이터를 한 번에 반환한다 (기획서 §8.3)
export async function GET() {
  const [inboxCount, resources] = isDbConfigured()
    ? await Promise.all([
        countUnprocessed().catch(() => 0),
        resourceTileCounts().catch(() => null),
      ])
    : [0, null];
  return NextResponse.json({
    schedule: { remainingToday: 0, nextEvent: null },
    projects: null, // v0.3
    ops: null, // v0.5
    resources,
    inboxCount,
  });
}
