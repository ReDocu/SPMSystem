import { NextResponse } from "next/server";
import { isDbConfigured } from "@/lib/db";
import { countUnprocessed } from "@/lib/inbox/repo";
import { resourceTileCounts } from "@/lib/resources/repo";
import { projectTileCounts } from "@/lib/projects/repo";

// 메인 런처 4타일 데이터를 한 번에 반환한다 (기획서 §8.3)
export async function GET() {
  const [inboxCount, resources, projects] = isDbConfigured()
    ? await Promise.all([
        countUnprocessed().catch(() => 0),
        resourceTileCounts().catch(() => null),
        projectTileCounts().catch(() => null),
      ])
    : [0, null, null];
  return NextResponse.json({
    schedule: { remainingToday: 0, nextEvent: null },
    projects,
    ops: null, // v0.5
    resources,
    inboxCount,
  });
}
