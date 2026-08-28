"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  CATEGORY_COLORS,
  CATEGORY_ICONS,
  type EventOccurrence,
  type ScheduleEvent,
} from "@/lib/schedule/event-model";
import type { DayStripe, MonthDue } from "@/lib/schedule/month";
import { EventForm } from "@/components/month/event-form";
import { UndoToasts, useUndoQueue } from "@/components/undo-toast";

const WEEKDAYS = ["월", "화", "수", "목", "금", "토", "일"];
const CONDITION_EMOJI: Record<number, string> = { 4: "😀", 3: "🙂", 2: "😐", 1: "🙁" };
const MAX_CELL_ITEMS = 3;

// 시리즈 삭제와 회차 취소 양쪽의 5초 되돌리기 payload
type MonthUndo =
  | { kind: "event"; event: ScheduleEvent }
  | { kind: "exdate"; eventId: string; date: string };

interface MonthGridProps {
  days: { date: string; inMonth: boolean }[];
  today: string;
  occurrences: EventOccurrence[];
  stripes: DayStripe[];
  conditions: { date: string; condition: number }[];
  dues: MonthDue[];
}

// 달별 그리드 — 기록 띠(주인공) > 일정 > 마감 > 마일스톤 레이어 (§5.2)
export function MonthGrid({ days, today, occurrences, stripes, conditions, dues }: MonthGridProps) {
  const router = useRouter();
  const [creating, setCreating] = useState<string | null>(null); // 더블클릭한 날짜
  const [editing, setEditing] = useState<EventOccurrence | null>(null);
  const undoQueue = useUndoQueue<MonthUndo>();

  const stripeOf = (date: string) => stripes.find((s) => s.date === date);
  const conditionOf = (date: string) => conditions.find((c) => c.date === date)?.condition;

  const handleDeleted = (event: ScheduleEvent) => {
    undoQueue.push({ key: event.id, label: event.title, payload: { kind: "event", event } });
  };

  const handleCancelledOccurrence = (event: ScheduleEvent, date: string) => {
    undoQueue.push({
      key: `${event.id}:${date}`,
      label: `${event.title} ${Number(date.slice(8))}일 회차`,
      payload: { kind: "exdate", eventId: event.id, date },
    });
  };

  return (
    <div className="overflow-hidden rounded-xl border border-line bg-surface">
      {creating && (
        <EventForm
          date={creating}
          onClose={() => setCreating(null)}
          onDeleted={handleDeleted}
          onCancelledOccurrence={handleCancelledOccurrence}
        />
      )}
      {editing && (
        <EventForm
          date={editing.date}
          occurrence={editing}
          onClose={() => setEditing(null)}
          onDeleted={handleDeleted}
          onCancelledOccurrence={handleCancelledOccurrence}
        />
      )}
      <div className="grid grid-cols-7 border-b border-line/50 text-center text-[11px] text-muted">
        {WEEKDAYS.map((w) => (
          <div key={w} className="py-1.5">{w}</div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {days.map(({ date, inMonth }) => {
          const stripe = stripeOf(date);
          const total = stripe?.segments.reduce((sum, s) => sum + s.min, 0) ?? 0;
          const dayEvents = occurrences.filter((o) => o.date === date);
          const dayDues = dues.filter((d) => d.date === date);
          const items = [...dayEvents.map(() => 1), ...dayDues.map(() => 1)].length;
          const overflow = items - MAX_CELL_ITEMS;
          const condition = conditionOf(date);
          let shown = 0;

          return (
            <div
              key={date}
              onClick={() => router.push(`/schedule/day/${date}`)}
              onDoubleClick={(e) => {
                e.stopPropagation();
                setCreating(date);
              }}
              className={`flex h-24 cursor-pointer flex-col gap-0.5 border-b border-r border-line/40 p-1 text-left transition-colors hover:bg-surface-2 ${
                inMonth ? "" : "opacity-40"
              }`}
            >
              <div className="flex items-center gap-1">
                <span
                  className={`text-[11px] leading-4 ${
                    date === today
                      ? "rounded-full bg-ink px-1.5 font-bold text-surface"
                      : "text-muted"
                  }`}
                >
                  {Number(date.slice(8))}
                </span>
                {condition && <span className="text-[10px]">{CONDITION_EMOJI[condition]}</span>}
                <span className="flex-1" />
              </div>

              {/* 기록 띠 — 읽기 전용, 시간 배분 히트맵의 재료 */}
              {total > 0 && (
                <div className="flex h-1 w-full overflow-hidden rounded-full bg-surface-2">
                  {stripe?.segments.map((seg, i) => (
                    <div
                      key={i}
                      style={{
                        width: `${(seg.min / total) * 100}%`,
                        backgroundColor: seg.color ?? "#B0AFAF",
                      }}
                    />
                  ))}
                </div>
              )}

              {dayEvents.map((occ) => {
                if (shown >= MAX_CELL_ITEMS) return null;
                shown += 1;
                return (
                  <button
                    key={`${occ.event.id}-${occ.dayIndex}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditing(occ);
                    }}
                    onDoubleClick={(e) => e.stopPropagation()}
                    style={{ backgroundColor: `${CATEGORY_COLORS[occ.event.category]}22` }}
                    className="truncate rounded px-1 text-left text-[10px] leading-4"
                    title={occ.event.title}
                  >
                    <span style={{ color: CATEGORY_COLORS[occ.event.category] }}>
                      {CATEGORY_ICONS[occ.event.category] ?? "▪"}
                    </span>{" "}
                    {occ.event.title}
                    {occ.spanDays > 1 && ` (${occ.dayIndex + 1}/${occ.spanDays})`}
                  </button>
                );
              })}

              {dayDues.map((due) => {
                if (shown >= MAX_CELL_ITEMS) return null;
                shown += 1;
                const isOverdue = !due.done && due.date < today;
                return (
                  <span
                    key={due.id}
                    className={`truncate px-1 text-[10px] leading-4 ${
                      isOverdue ? "text-red-400" : due.done ? "text-muted line-through" : "text-muted"
                    }`}
                    title={due.title}
                  >
                    {due.isMilestone ? "◆" : "•"} {due.title}
                  </span>
                );
              })}

              {overflow > 0 && <span className="px-1 text-[10px] text-muted">+{overflow}</span>}
            </div>
          );
        })}
      </div>

      <UndoToasts
        entries={undoQueue.entries}
        onUndo={async (entry) => {
          const undo = undoQueue.take(entry);
          if (undo.kind === "event") {
            await fetch(`/api/schedules/${undo.event.id}/restore`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(undo.event),
            }).catch(() => null);
          } else {
            await fetch(`/api/schedules/${undo.eventId}/exdate`, {
              method: "DELETE",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ date: undo.date }),
            }).catch(() => null);
          }
          router.refresh();
        }}
      />
    </div>
  );
}
