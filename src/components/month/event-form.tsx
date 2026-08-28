"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  EVENT_CATEGORIES,
  RRULE_OPTIONS,
  type EventCategory,
  type EventOccurrence,
  type ScheduleEvent,
} from "@/lib/schedule/event-model";
import { formatGuessDate } from "@/lib/capture/format";

const toTime = (min: number) =>
  `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
const toMin = (time: string) => {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
};

interface EventFormProps {
  date: string;
  occurrence?: EventOccurrence; // 있으면 편집 모드
  onClose: () => void;
  onDeleted: (event: ScheduleEvent) => void;
  onCancelledOccurrence: (event: ScheduleEvent, date: string) => void;
}

// 일정 인라인 폼 (§5.6 — 모달 금지). 반복 편집은 시리즈/회차를 구분해 묻는다 (§5.5)
export function EventForm({ date, occurrence, onClose, onDeleted, onCancelledOccurrence }: EventFormProps) {
  const router = useRouter();
  const event = occurrence?.event ?? null;
  const isRecurring = Boolean(event?.rrule);
  const [title, setTitle] = useState(event?.title ?? "");
  const [allDay, setAllDay] = useState(event?.allDay ?? false);
  const [start, setStart] = useState(toTime(event && !event.allDay ? event.startMin : 9 * 60));
  const [end, setEnd] = useState(toTime(event && !event.allDay ? event.endMin : 10 * 60));
  const [endDate, setEndDate] = useState(event && event.endDate !== event.startDate ? event.endDate : "");
  const [category, setCategory] = useState<EventCategory>(event?.category ?? "일반");
  const [rrule, setRrule] = useState(event?.rrule ?? "");
  const [error, setError] = useState<string | null>(null);

  const buildBody = (overrides: Partial<Record<string, unknown>> = {}) => ({
    title: title.trim(),
    date: event?.startDate ?? date,
    endDate: !rrule && endDate ? endDate : null,
    startMin: allDay ? null : toMin(start),
    endMin: allDay ? null : toMin(end),
    allDay,
    category,
    rrule: rrule || null,
    ...overrides,
  });

  const call = async (url: string, method: string, body?: object) => {
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    }).catch(() => null);
    if (!res?.ok) {
      const data = await res?.json().catch(() => null);
      setError(data?.error ?? "처리하지 못했습니다");
      return false;
    }
    return true;
  };

  const finish = () => {
    onClose();
    router.refresh();
  };

  const handleCreate = async () => {
    if (!title.trim()) return;
    if (await call("/api/schedules", "POST", buildBody())) finish();
  };

  const handleSaveSeries = async () => {
    if (!event || !title.trim()) return;
    if (await call(`/api/schedules/${event.id}`, "PATCH", buildBody())) finish();
  };

  // 즉시 취소 + 5초 되돌리기 (exdate 제거로 복원)
  const handleCancelOccurrence = async () => {
    if (!event || !occurrence) return;
    if (await call(`/api/schedules/${event.id}/exdate`, "POST", { date: occurrence.date })) {
      onCancelledOccurrence(event, occurrence.date);
      finish();
    }
  };

  // 이 회차만 변경 — 서버가 취소+단발 생성을 한 트랜잭션으로 처리 (§5.5)
  const handleEditOccurrence = async () => {
    if (!event || !occurrence || !title.trim()) return;
    const body = buildBody({ date: occurrence.date, rrule: null, endDate: null });
    if (await call(`/api/schedules/${event.id}/occurrence`, "POST", { ...body, occurrenceDate: occurrence.date })) {
      finish();
    }
  };

  const handleDelete = async () => {
    if (!event) return;
    const res = await fetch(`/api/schedules/${event.id}`, { method: "DELETE" }).catch(() => null);
    if (!res?.ok) {
      setError("삭제하지 못했습니다");
      return;
    }
    const { item } = (await res.json()) as { item: ScheduleEvent };
    onDeleted(item);
    finish();
  };

  const btn = "rounded-md border border-line px-2.5 py-1.5 text-xs text-muted hover:text-ink";
  const primaryBtn = "rounded-md border border-ink px-3 py-1.5 text-xs font-medium hover:bg-surface-2";

  return (
    <div className="flex flex-col gap-2 border-b border-line bg-surface-2/50 p-3" onClick={(e) => e.stopPropagation()}>
      <div className="flex items-center gap-2 text-xs">
        <span className="flex-none font-bold">
          {event ? `일정 편집 — ${formatGuessDate(occurrence?.date ?? date)}` : `새 일정 — ${formatGuessDate(date)}`}
          {isRecurring && " (반복)"}
        </span>
        <span className="flex-1" />
        {error && <span className="text-muted">{error}</span>}
        <button onClick={onClose} className="px-1 text-muted hover:text-ink">✕</button>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <input
          autoFocus
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && (event ? handleSaveSeries() : handleCreate())}
          placeholder="제목"
          className="w-48 rounded-md border border-line bg-surface px-2.5 py-1.5 text-xs outline-none focus:border-primary"
        />
        <label className="flex items-center gap-1 text-[11px] text-muted">
          <input type="checkbox" checked={allDay} onChange={(e) => setAllDay(e.target.checked)} />
          종일
        </label>
        {!allDay && (
          <>
            <input type="time" value={start} onChange={(e) => setStart(e.target.value)} className="rounded-md border border-line bg-surface px-1.5 py-1 text-xs" />
            <span className="text-xs text-muted">–</span>
            <input type="time" value={end} onChange={(e) => setEnd(e.target.value)} className="rounded-md border border-line bg-surface px-1.5 py-1 text-xs" />
          </>
        )}
        <select value={category} onChange={(e) => setCategory(e.target.value as EventCategory)} className="rounded-md border border-line bg-surface px-1.5 py-1.5 text-xs">
          {EVENT_CATEGORIES.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        <select value={rrule} onChange={(e) => setRrule(e.target.value)} className="rounded-md border border-line bg-surface px-1.5 py-1.5 text-xs">
          {RRULE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        {!rrule && (
          <label className="flex items-center gap-1 text-[11px] text-muted">
            ~
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="rounded-md border border-line bg-surface px-1.5 py-1 text-xs" title="여러 날 일정(출장)의 종료일" />
          </label>
        )}
      </div>
      <div className="flex items-center justify-end gap-2">
        {!event && (
          <button onClick={handleCreate} className={primaryBtn}>추가</button>
        )}
        {event && !isRecurring && (
          <>
            <button onClick={handleDelete} className={btn}>삭제</button>
            <button onClick={handleSaveSeries} className={primaryBtn}>저장</button>
          </>
        )}
        {event && isRecurring && (
          <>
            <button onClick={handleCancelOccurrence} className={btn}>이 회차 취소</button>
            <button onClick={handleEditOccurrence} className={btn}>이 회차만 변경</button>
            <button onClick={handleDelete} className={btn}>시리즈 삭제</button>
            <button onClick={handleSaveSeries} className={primaryBtn}>시리즈 저장</button>
          </>
        )}
      </div>
    </div>
  );
}
