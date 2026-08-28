import { NextResponse, type NextRequest } from "next/server";
import { isDbConfigured } from "@/lib/db";
import { setTaskPlannedDate, setTaskStatus } from "@/lib/schedule/repo";
import { isDateKey } from "@/lib/schedule/validate";

// 체크(status) · 오늘로 재선정/백로그 반환(plannedDate) — 한 번에 하나의 변경만 받는다
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!isDbConfigured()) return NextResponse.json({ error: "DB 미설정" }, { status: 503 });
  const { id } = await params;

  let body: { status?: unknown; plannedDate?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청 본문" }, { status: 400 });
  }

  try {
    if (body.status !== undefined) {
      if (body.status !== "todo" && body.status !== "done") {
        return NextResponse.json({ error: "상태가 올바르지 않습니다" }, { status: 400 });
      }
      const task = await setTaskStatus(id, body.status);
      if (!task) return NextResponse.json({ error: "태스크가 없습니다" }, { status: 404 });
      return NextResponse.json({ task });
    }

    if (body.plannedDate !== undefined) {
      if (body.plannedDate !== null && !isDateKey(body.plannedDate)) {
        return NextResponse.json({ error: "날짜가 올바르지 않습니다" }, { status: 400 });
      }
      const task = await setTaskPlannedDate(id, body.plannedDate as string | null);
      if (!task) return NextResponse.json({ error: "태스크가 없습니다" }, { status: 404 });
      return NextResponse.json({ task });
    }

    return NextResponse.json({ error: "변경할 내용이 없습니다" }, { status: 400 });
  } catch (error) {
    console.error("tasks PATCH 실패:", error);
    return NextResponse.json({ error: "수정하지 못했습니다" }, { status: 500 });
  }
}
