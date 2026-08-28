import { NextResponse } from "next/server";
import { isDbConfigured } from "@/lib/db";
import { countUnprocessed } from "@/lib/inbox/repo";
import { resourceTileCounts } from "@/lib/resources/repo";
import { projectTileCounts } from "@/lib/projects/repo";
import { scheduleTileCounts } from "@/lib/schedule/repo";
import { opsTileCounts } from "@/lib/ops/repo";
import { toDateKey } from "@/lib/dates";

// 메인 런처 4타일 데이터를 한 번에 반환한다 (기획서 §8.3)
export async function GET() {
  const now = new Date();
  const [inboxCount, resources, projects, schedule, ops] = isDbConfigured()
    ? await Promise.all([
        countUnprocessed().catch(() => 0),
        resourceTileCounts().catch(() => null),
        projectTileCounts().catch(() => null),
        scheduleTileCounts(toDateKey(now), now.getHours() * 60 + now.getMinutes()).catch(() => null),
        opsTileCounts(toDateKey(now)).catch(() => null),
      ])
    : [0, null, null, null, null];
  return NextResponse.json({ schedule, projects, ops, resources, inboxCount });
}
