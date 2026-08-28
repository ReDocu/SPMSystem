"use client";

import { useRef, useState } from "react";

export interface UndoEntry<T> {
  key: string;
  label: string;
  payload: T;
}

const UNDO_MS = 5000;

/** 즉시 삭제 + 5초 되돌리기 큐 (공통 규칙 §0.4) — 연속 삭제해도 각 항목의 복구 경로를 보존한다. */
export function useUndoQueue<T>() {
  const [entries, setEntries] = useState<UndoEntry<T>[]>([]);
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  const push = (entry: UndoEntry<T>) => {
    setEntries((prev) => [...prev, entry]);
    timers.current.set(
      entry.key,
      setTimeout(() => {
        setEntries((prev) => prev.filter((e) => e.key !== entry.key));
        timers.current.delete(entry.key);
      }, UNDO_MS),
    );
  };

  /** 되돌리기 선택 — 타이머 해제 후 payload를 돌려준다. */
  const take = (entry: UndoEntry<T>) => {
    const timer = timers.current.get(entry.key);
    if (timer) clearTimeout(timer);
    timers.current.delete(entry.key);
    setEntries((prev) => prev.filter((e) => e.key !== entry.key));
    return entry.payload;
  };

  return { entries, push, take };
}

export function UndoToasts<T>({
  entries,
  onUndo,
}: {
  entries: UndoEntry<T>[];
  onUndo: (entry: UndoEntry<T>) => void;
}) {
  if (entries.length === 0) return null;
  return (
    <div className="fixed bottom-5 left-1/2 z-50 flex -translate-x-1/2 flex-col gap-2">
      {entries.map((entry) => (
        <div
          key={entry.key}
          className="flex items-center gap-3 rounded-lg border border-line bg-surface px-4 py-2.5 text-xs shadow-lg"
        >
          <span className="max-w-56 truncate text-muted">삭제됨 — {entry.label}</span>
          <button
            onClick={() => onUndo(entry)}
            className="font-medium text-ink underline underline-offset-2"
          >
            되돌리기
          </button>
        </div>
      ))}
    </div>
  );
}
