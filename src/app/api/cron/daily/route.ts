import { NextResponse, type NextRequest } from "next/server";
import { isDbConfigured } from "@/lib/db";
import { formatKoreanDate, toDateKey } from "@/lib/dates";
import { hasValidSession, isAutomationAuthorized } from "@/lib/auth/automation";
import { buildDailySummary } from "@/lib/notify/daily";
import { listOccurrences } from "@/lib/schedule/events";
import { lastWeekByProject, listDueTitles } from "@/lib/schedule/repo";
import { listExpiring } from "@/lib/ops/repo";
import { countUnprocessed } from "@/lib/inbox/repo";
import { resourceTileCounts } from "@/lib/resources/repo";

const toTime = (min: number) =>
  `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;

/**
 * 일일 요약 (기획서 §9.1) — 로컬 스케줄러(작업 스케줄러 등)가 하루 한 번 호출한다 (§8.1).
 * SPM_DISCORD_WEBHOOK이 있으면 Discord로 발송, 없으면 미리보기만 반환.
 * 인증: 자동화 토큰(스케줄러) 또는 PIN 세션(설정의 테스트 버튼).
 */
export async function POST(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");
  if (!isAutomationAuthorized(token) && !hasValidSession(request)) {
    return NextResponse.json({ error: "인증이 필요합니다" }, { status: 401 });
  }
  if (!isDbConfigured()) return NextResponse.json({ error: "DB 미설정" }, { status: 503 });

  try {
    const now = new Date();
    const today = toDateKey(now);
    const in7 = toDateKey(new Date(now.getTime() + 7 * 86_400_000));
    const isMonday = now.getDay() === 1;

    const [occurrences, upcoming, dueTasks, expiring, inboxCount, resources, weekly] =
      await Promise.all([
        listOccurrences(today, today).catch(() => []),
        listOccurrences(today, in7).catch(() => []),
        listDueTitles(today).catch(() => []),
        listExpiring(today).catch(() => []),
        countUnprocessed().catch(() => 0),
        resourceTileCounts().catch(() => ({ weekCount: 0, ideaCount: 0 })),
        isMonday ? lastWeekByProject().catch(() => null) : Promise.resolve(null),
      ]);

    const message = buildDailySummary({
      dateLabel: formatKoreanDate(now),
      events: occurrences
        .filter((o) => !o.event.allDay && o.event.category !== "기념일")
        .map((o) => ({ time: toTime(o.event.startMin), title: o.event.title })),
      anniversaries: upcoming
        .filter((o) => o.event.category === "기념일")
        .map((o) => ({
          title: o.event.title,
          dday: Math.round((new Date(o.date).getTime() - new Date(today).getTime()) / 86_400_000),
        })),
      dueTasks,
      // 만료 목록은 D-30까지 모으지만 발송은 D-7부터 (화면명세서 §6-1 ①)
      expiring: expiring
        .filter((e) => e.daysLeft <= 7)
        .map((e) => ({ label: e.label, dday: e.daysLeft })),
      inboxCount,
      weekCollected: resources.weekCount,
      weekly: weekly && weekly.totalMin > 0 ? weekly : null,
    });

    const webhook = process.env.SPM_DISCORD_WEBHOOK;
    let sent = false;
    if (webhook) {
      const res = await fetch(webhook, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: message }),
        signal: AbortSignal.timeout(5000),
      }).catch(() => null);
      sent = Boolean(res?.ok);
    }
    return NextResponse.json({ sent, preview: message });
  } catch (error) {
    console.error("cron daily 실패:", error);
    return NextResponse.json({ error: "요약을 만들지 못했습니다" }, { status: 500 });
  }
}
