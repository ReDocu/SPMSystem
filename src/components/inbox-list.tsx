"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { parseCapture, type CaptureGuess } from "@/lib/capture/parse";
import { guessBadges } from "@/lib/capture/format";
import type { InboxItem } from "@/lib/inbox/repo";
import { UndoToasts, useUndoQueue, type UndoEntry } from "@/components/undo-toast";

type ProcessAs = "task" | "timelog" | "resource" | "project_task" | "project_idea" | "event";

interface ProcessAction {
  label: string;
  as: ProcessAs;
}

// 기본 버튼 1개 + 탈출구 (§4.3). 아이디어의 종착지는 자료수집, 프로젝트 아이디어는 idea 프로젝트 (R3)
function processActions(guess: CaptureGuess): ProcessAction[] {
  if (guess.type === "project_task") {
    return [
      { label: `▤ #${guess.project} 태스크로`, as: "project_task" },
      // 시간 범위까지 있으면 기록으로 남길 탈출구도 유지 ("#SPM 9-12 개발")
      ...(guess.timeRange ? [{ label: "⏱ 타임로그로", as: "timelog" } as ProcessAction] : []),
      { label: "할 일로", as: "task" },
    ];
  }
  if (guess.type === "resource") {
    return [
      { label: "◈ 자료로", as: "resource" },
      { label: "할 일로", as: "task" },
    ];
  }
  if (guess.type === "idea" || guess.type === "snippet") {
    return [
      { label: "아이디어로", as: "resource" },
      { label: "할 일로", as: "task" },
      { label: "프로젝트 아이디어", as: "project_idea" },
    ];
  }
  if (guess.type === "event") {
    return [
      { label: "◷ 일정으로", as: "event" },
      { label: "⏱ 타임로그로", as: "timelog" },
      { label: "할 일로", as: "task" },
    ];
  }
  if (guess.timeRange) {
    return [
      { label: "⏱ 타임로그로", as: "timelog" },
      { label: "할 일로", as: "task" },
    ];
  }
  return [
    { label: "✓ 할 일로", as: "task" },
    { label: "아이디어로", as: "resource" },
  ];
}

const FADE_MS = 300; // 처리 후 0.3초 페이드 아웃 (§0.4)
const SOURCE_ICONS: Record<string, string> = { web: "🌐", bookmarklet: "🔖", mobile: "📱" };

export function InboxList({ initialItems }: { initialItems: InboxItem[] }) {
  const router = useRouter();
  const [items, setItems] = useState(initialItems);
  const [leavingIds, setLeavingIds] = useState<Set<string>>(new Set());
  const undoQueue = useUndoQueue<InboxItem>();
  const [error, setError] = useState<string | null>(null);

  // router.refresh()가 가져온 서버 데이터로 재동기화 (렌더 중 상태 보정 패턴) —
  // 북마클릿·다른 탭에서 들어온 캡처가 새로고침 없이 보여야 한다
  const [prevInitial, setPrevInitial] = useState(initialItems);
  if (initialItems !== prevInitial) {
    setPrevInitial(initialItems);
    setItems(initialItems);
    setLeavingIds(new Set());
  }

  const removeWithFade = useCallback((id: string) => {
    setLeavingIds((prev) => new Set(prev).add(id));
    setTimeout(() => {
      setItems((prev) => prev.filter((item) => item.id !== id));
      setLeavingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }, FADE_MS);
  }, []);

  const handleProcess = useCallback(
    async (id: string, as: ProcessAs) => {
      setError(null);
      const res = await fetch(`/api/inbox/${id}/process`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ as }),
      }).catch(() => null);
      if (!res?.ok) {
        setError("처리하지 못했습니다 — 다시 시도해주세요");
        return;
      }
      removeWithFade(id);
      router.refresh();
    },
    [removeWithFade, router],
  );

  const handleDelete = useCallback(
    async (id: string) => {
      setError(null);
      const res = await fetch(`/api/inbox/${id}`, { method: "DELETE" }).catch(() => null);
      if (!res?.ok) {
        setError("삭제하지 못했습니다 — 다시 시도해주세요");
        return;
      }
      const { item } = (await res.json()) as { item: InboxItem };
      removeWithFade(id);
      undoQueue.push({ key: item.id, label: item.rawText, payload: item });
      router.refresh();
    },
    [removeWithFade, router, undoQueue],
  );

  const handleUndo = useCallback(
    async (entry: UndoEntry<InboxItem>) => {
      const item = undoQueue.take(entry);
      const res = await fetch(`/api/inbox/${item.id}/restore`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(item),
      }).catch(() => null);
      if (!res?.ok) {
        setError("되돌리지 못했습니다");
        return;
      }
      setItems((prev) => [...prev, item].sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
      router.refresh();
    },
    [router, undoQueue],
  );

  const handleProcessAll = useCallback(async () => {
    setError(null);
    const res = await fetch("/api/inbox/process-all", { method: "POST" }).catch(() => null);
    if (!res?.ok) {
      setError("처리하지 못했습니다 — 다시 시도해주세요");
      return;
    }
    items.forEach((item) => removeWithFade(item.id));
    router.refresh();
  }, [items, removeWithFade, router]);

  const visibleCount = useMemo(
    () => items.filter((item) => !leavingIds.has(item.id)).length,
    [items, leavingIds],
  );

  return (
    <div className="flex flex-col gap-5">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <h1 className="text-lg font-bold">인박스</h1>
          <span className="rounded-full border border-line bg-surface-2 px-2 text-[11px] text-muted">
            {visibleCount}
          </span>
        </div>
        {visibleCount > 0 && (
          <button
            onClick={handleProcessAll}
            className="rounded-md border border-line bg-surface px-3 py-1.5 text-xs text-muted hover:text-ink"
          >
            모두 처리 완료
          </button>
        )}
      </header>

      {error && (
        <p className="rounded-md border border-line bg-surface-2 px-3 py-2 text-xs text-muted">
          {error}
        </p>
      )}

      {items.length === 0 ? (
        <div className="rounded-xl border border-line bg-surface p-10 text-center text-sm text-muted">
          인박스가 비었습니다 ✨
        </div>
      ) : (
        <ul className="overflow-hidden rounded-xl border border-line bg-surface">
          {items.map((item) => {
            // 상대 날짜("내일")는 캡처 시점 기준 — 전환 시 저장될 값과 배지가 일치해야 한다
            const guess = parseCapture(item.rawText, new Date(item.createdAt));
            const badges = guessBadges(guess);
            return (
              <li
                key={item.id}
                className={`flex flex-col gap-2 border-b border-line/50 px-5 py-4 transition-opacity duration-300 last:border-b-0 ${
                  leavingIds.has(item.id) ? "opacity-0" : "opacity-100"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="min-w-0 whitespace-pre-wrap break-words text-sm">{item.rawText}</p>
                  <span className="flex-none text-xs" title={item.source}>
                    {SOURCE_ICONS[item.source] ?? "🌐"}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  {badges.map((badge) => (
                    <span
                      key={badge}
                      className="rounded-full border border-line bg-surface-2 px-2 py-0.5 text-[11px] text-muted"
                    >
                      {badge}
                    </span>
                  ))}
                  <span className="flex-1" />
                  {processActions(guess).map((action, i) => (
                    <button
                      key={action.as}
                      onClick={() => handleProcess(item.id, action.as)}
                      className={`rounded-md border px-2.5 py-1 text-xs ${
                        i === 0
                          ? "border-ink font-medium hover:bg-surface-2"
                          : "border-line text-muted hover:text-ink"
                      }`}
                    >
                      {action.label}
                    </button>
                  ))}
                  <button
                    onClick={() => handleDelete(item.id)}
                    className="rounded-md border border-line px-2.5 py-1 text-xs text-muted hover:text-ink"
                  >
                    삭제
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <UndoToasts entries={undoQueue.entries} onUndo={handleUndo} />
    </div>
  );
}
