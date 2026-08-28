"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { EventOccurrence } from "@/lib/schedule/event-model";

// 올해의 기념일 — 월별 그룹, D-day, 지난 것 흐림. 연 반복+종일 event CRUD (§6.4)
export function Anniversaries({
  occurrences,
  today,
}: {
  occurrences: EventOccurrence[];
  today: string;
}) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");

  const add = async () => {
    if (!title.trim() || !date) return;
    const res = await fetch("/api/schedules", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: title.trim(), date, allDay: true, category: "기념일", rrule: "FREQ=YEARLY" }),
    }).catch(() => null);
    if (res?.ok) {
      setTitle("");
      setDate("");
      router.refresh();
    }
  };

  const dday = (d: string) => {
    const diff = Math.round(
      (new Date(d).getTime() - new Date(today).getTime()) / 86_400_000,
    );
    return diff === 0 ? "D-day" : diff > 0 ? `D-${diff}` : "지남";
  };

  const byMonth = new Map<number, EventOccurrence[]>();
  for (const occ of occurrences) {
    const month = Number(occ.date.slice(5, 7));
    byMonth.set(month, [...(byMonth.get(month) ?? []), occ]);
  }

  return (
    <section className="rounded-xl border border-line bg-surface p-4">
      <h2 className="mb-2 text-[13px] font-bold">🎂 올해의 기념일</h2>
      {occurrences.length === 0 && <p className="mb-2 text-xs text-muted">아직 없음</p>}
      <div className="flex flex-col gap-1.5">
        {[...byMonth.entries()]
          .sort(([a], [b]) => a - b)
          .map(([month, items]) => (
            <div key={month} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-xs">
              <span className="w-8 flex-none text-muted">{month}월</span>
              {items.map((occ) => {
                const past = occ.date < today;
                return (
                  <span key={`${occ.event.id}-${occ.date}`} className={past ? "opacity-45" : ""}>
                    {occ.event.title}
                    <span className="ml-1 text-[11px] text-muted">{past ? "(지남)" : dday(occ.date)}</span>
                  </span>
                );
              })}
            </div>
          ))}
      </div>
      <div className="mt-2.5 flex items-center gap-2">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
          placeholder="+ 기념일 (매년 반복)"
          className="min-w-0 flex-1 rounded-md border border-dashed border-line bg-transparent px-2.5 py-1.5 text-xs outline-none placeholder:text-muted focus:border-primary"
        />
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="flex-none rounded-md border border-line bg-surface px-2 py-1.5 text-xs"
        />
      </div>
    </section>
  );
}
