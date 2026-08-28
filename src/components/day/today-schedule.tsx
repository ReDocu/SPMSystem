"use client";

import { useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";

const subscribeMinute = (cb: () => void) => {
  const timer = setInterval(cb, 60_000);
  return () => clearInterval(timer);
};
const currentMin = () => {
  const now = new Date();
  return now.getHours() * 60 + now.getMinutes();
};
import { CATEGORY_COLORS, CATEGORY_ICONS, type EventOccurrence } from "@/lib/schedule/event-model";
import { formatTimeRange } from "@/lib/capture/format";

// 오늘 일정 — event 읽기 전용. 지난 일정 [기록으로 복사] → 타임로그 변환 (USE-01, §4-1 ⑧)
export function TodaySchedule({
  date,
  today,
  occurrences,
  isToday,
}: {
  date: string;
  today: string;
  occurrences: EventOccurrence[];
  isToday: boolean;
}) {
  const router = useRouter();
  // 현재 시각은 외부 시스템 — SSR은 null, 클라이언트는 분 단위 구독
  const nowMin = useSyncExternalStore(subscribeMinute, currentMin, () => null);
  const [copiedIds, setCopiedIds] = useState<Set<string>>(new Set());

  if (occurrences.length === 0) return null;

  const copyToLog = async (occ: EventOccurrence) => {
    const res = await fetch("/api/timelogs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        date,
        startMin: occ.event.startMin,
        endMin: occ.event.endMin,
        content: occ.event.title,
      }),
    }).catch(() => null);
    if (res?.ok) {
      setCopiedIds((prev) => new Set(prev).add(occ.event.id));
      router.refresh();
    }
  };

  return (
    <section className="rounded-lg border border-line bg-surface p-3.5">
      <h2 className="mb-2 text-[13px] font-bold">오늘 일정</h2>
      <ul className="flex flex-col gap-1.5">
        {occurrences.map((occ) => {
          // 여러 날 일정은 endMin이 다른 날의 벽시계 시각 — 하루짜리에만 시각 판정·복사를 적용
          const isSingleDay = occ.event.startDate === occ.event.endDate;
          const isPast =
            !occ.event.allDay &&
            isSingleDay &&
            (date < today || (isToday && nowMin !== null && occ.event.endMin <= nowMin));
          return (
            <li key={`${occ.event.id}-${occ.dayIndex}`} className="flex items-center gap-2 text-xs">
              <span style={{ color: CATEGORY_COLORS[occ.event.category] }} className="flex-none">
                {CATEGORY_ICONS[occ.event.category] ?? "▪"}
              </span>
              {!occ.event.allDay && (
                <span className="flex-none font-mono text-[11px] text-muted">
                  {formatTimeRange({ startMin: occ.event.startMin, endMin: occ.event.endMin }).slice(0, 5)}
                </span>
              )}
              <span className="min-w-0 flex-1 truncate">{occ.event.title}</span>
              {isPast && !occ.event.allDay && !copiedIds.has(occ.event.id) && (
                <button
                  onClick={() => copyToLog(occ)}
                  className="flex-none rounded border border-line px-1.5 py-0.5 text-[11px] text-muted hover:text-ink"
                  title="타임로그로 변환 — 이중 입력 제거"
                >
                  기록으로 복사
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
