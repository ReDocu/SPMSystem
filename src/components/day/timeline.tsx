"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { parseCapture } from "@/lib/capture/parse";
import { mergeAdjacentLogs, type MergedBlock } from "@/lib/schedule/blocks";
import { formatTimeRange } from "@/lib/capture/format";
import type { TimeLog } from "@/lib/schedule/repo";
import { UndoToasts, useUndoQueue, type UndoEntry } from "@/components/undo-toast";

const HOUR_PX = 40; // 1시간 = 40px (h-10)
const COLLAPSE_END = 6 * 60; // 00–06 기본 접힘

interface Draft {
  startMin: number;
  endMin: number;
  text: string;
}

export function Timeline({ date, logs, isToday }: { date: string; logs: TimeLog[]; isToday: boolean }) {
  const router = useRouter();
  const blocks = useMemo(() => mergeAdjacentLogs(logs), [logs]);
  const hasEarlyLogs = blocks.some((b) => b.startMin < COLLAPSE_END);
  const [expanded, setExpanded] = useState(hasEarlyLogs);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [editing, setEditing] = useState<{ block: MergedBlock; text: string } | null>(null);
  const [nowMin, setNowMin] = useState<number | null>(null);
  const undoQueue = useUndoQueue<TimeLog[]>();

  // "3-5 새벽 작업"처럼 접힌 구간에 블록이 생기면 자동으로 펼친다 (렌더 중 상태 보정 패턴)
  const [prevHasEarlyLogs, setPrevHasEarlyLogs] = useState(hasEarlyLogs);
  if (hasEarlyLogs !== prevHasEarlyLogs) {
    setPrevHasEarlyLogs(hasEarlyLogs);
    if (hasEarlyLogs) setExpanded(true);
  }

  useEffect(() => {
    if (!isToday) return;
    const update = () => {
      const now = new Date();
      setNowMin(now.getHours() * 60 + now.getMinutes());
    };
    update();
    const timer = setInterval(update, 60_000);
    return () => clearInterval(timer);
  }, [isToday]);

  const startHour = expanded ? 0 : 6;
  const hours = Array.from({ length: 24 - startHour }, (_, i) => i + startHour);
  const top = (min: number) => ((min - startHour * 60) / 60) * HOUR_PX;

  const handleCreate = async () => {
    if (!draft) return;
    const text = draft.text.trim();
    if (!text) {
      setDraft(null);
      return;
    }
    // "9-12 SPM 개발"처럼 시간 범위를 쓰면 그 범위가 슬롯보다 우선 (상세기획 §4.3)
    const guess = parseCapture(text);
    const range = guess.timeRange ?? { startMin: draft.startMin, endMin: draft.endMin };
    // 파싱이 #태그를 제목 밖으로 빼므로 내용에 되살린다 — 프로젝트 자동 연결의 재료
    const content = guess.timeRange
      ? [guess.title || text, guess.project && `#${guess.project}`].filter(Boolean).join(" ")
      : text;
    const res = await fetch("/api/timelogs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date, startMin: range.startMin, endMin: range.endMin, content }),
    }).catch(() => null);
    if (res?.ok) {
      setDraft(null);
      router.refresh();
    }
  };

  const handleEdit = async () => {
    if (!editing) return;
    const text = editing.text.trim();
    if (!text || text === editing.block.content) {
      setEditing(null);
      return;
    }
    const res = await fetch("/api/timelogs", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: editing.block.logIds, content: text }),
    }).catch(() => null);
    if (res?.ok) {
      setEditing(null);
      router.refresh();
    }
  };

  // 즉시 삭제 + 5초 되돌리기 (프로젝트 공통 규칙 — 확인 모달 금지)
  const handleDelete = async () => {
    if (!editing) return;
    const deletedLogs = logs.filter((l) => editing.block.logIds.includes(l.id));
    const res = await fetch("/api/timelogs", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: editing.block.logIds }),
    }).catch(() => null);
    if (!res?.ok) return;
    setEditing(null);
    undoQueue.push({
      key: editing.block.logIds[0],
      label: editing.block.content,
      payload: deletedLogs,
    });
    router.refresh();
  };

  const handleUndo = async (entry: UndoEntry<TimeLog[]>) => {
    const logs = undoQueue.take(entry);
    await Promise.all(
      logs.map((l) =>
        fetch("/api/timelogs", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ date, startMin: l.startMin, endMin: l.endMin, content: l.content }),
        }).catch(() => null),
      ),
    );
    router.refresh();
  };

  return (
    <section className="min-w-0 flex-1">
      {!expanded ? (
        <button
          onClick={() => setExpanded(true)}
          className="mb-2 w-full rounded-md border border-dashed border-line px-3 py-1.5 text-left text-xs text-muted hover:text-ink"
        >
          ▸ 00–06 (접힘)
        </button>
      ) : (
        <button
          onClick={() => setExpanded(false)}
          className="mb-2 w-full rounded-md border border-dashed border-line px-3 py-1.5 text-left text-xs text-muted hover:text-ink"
        >
          ▾ 00–06 접기
        </button>
      )}

      <div className="relative">
        {hours.map((h) => (
          <div key={h} className="flex h-10 items-start gap-2.5">
            <span className="w-6 text-right font-mono text-xs text-muted">
              {String(h).padStart(2, "0")}
            </span>
            <div
              className="h-full flex-1 cursor-pointer"
              onClick={() => setDraft({ startMin: h * 60, endMin: (h + 1) * 60, text: "" })}
            >
              <div className="h-px translate-y-2 bg-line" />
            </div>
          </div>
        ))}

        {/* 블록 레이어 — 시간 라벨(w-6) + 간격만큼 들여쓴다 */}
        <div className="pointer-events-none absolute inset-y-0 left-9 right-0">
          {blocks
            .filter((b) => b.endMin > startHour * 60)
            .map((block) => (
              <button
                key={block.logIds[0]}
                onClick={() => setEditing({ block, text: block.content })}
                style={{
                  top: top(Math.max(block.startMin, startHour * 60)) + 8,
                  height: ((block.endMin - Math.max(block.startMin, startHour * 60)) / 60) * HOUR_PX,
                }}
                className="pointer-events-auto absolute left-0 right-3 overflow-hidden rounded-md border border-primary/40 bg-primary/10 px-2.5 py-1 text-left text-xs hover:border-primary"
              >
                <span className="font-medium">{block.content}</span>
                <span className="ml-1.5 text-[10px] text-muted">
                  {formatTimeRange({ startMin: block.startMin, endMin: block.endMin })}
                </span>
              </button>
            ))}

          {nowMin !== null && nowMin >= startHour * 60 && (
            <div
              style={{ top: top(nowMin) + 8 }}
              className="absolute left-0 right-0 border-t border-red-400"
            >
              <span className="absolute -top-2 right-0 text-[10px] text-red-400">
                {formatTimeRange({ startMin: nowMin, endMin: nowMin }).slice(0, 5)}
              </span>
            </div>
          )}

          {draft && (
            <div
              style={{ top: top(draft.startMin) + 8 }}
              className="pointer-events-auto absolute left-0 right-3"
            >
              <input
                autoFocus
                value={draft.text}
                onChange={(e) => setDraft({ ...draft, text: e.target.value })}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleCreate();
                  if (e.key === "Escape") setDraft(null);
                }}
                onBlur={() => !draft.text.trim() && setDraft(null)}
                placeholder="무엇을 했나요? (예: SPM 개발 #SPM, 9-12 회의)"
                className="w-full rounded-md border border-primary bg-surface px-2.5 py-1.5 text-xs outline-none"
              />
            </div>
          )}
        </div>
      </div>

      {editing && (
        <div className="mt-3 flex items-center gap-2 rounded-lg border border-line bg-surface p-2.5">
          <span className="flex-none text-[11px] text-muted">
            {formatTimeRange({ startMin: editing.block.startMin, endMin: editing.block.endMin })}
          </span>
          <input
            autoFocus
            value={editing.text}
            onChange={(e) => setEditing({ ...editing, text: e.target.value })}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleEdit();
              if (e.key === "Escape") setEditing(null);
            }}
            className="min-w-0 flex-1 rounded-md border border-line bg-transparent px-2 py-1 text-xs outline-none focus:border-primary"
          />
          <button onClick={handleEdit} className="rounded-md border border-ink px-2.5 py-1 text-xs font-medium">
            저장
          </button>
          <button onClick={handleDelete} className="rounded-md border border-line px-2.5 py-1 text-xs text-muted hover:text-ink">
            삭제
          </button>
          <button onClick={() => setEditing(null)} className="px-1 text-xs text-muted">
            ✕
          </button>
        </div>
      )}

      <UndoToasts entries={undoQueue.entries} onUndo={handleUndo} />
    </section>
  );
}
