"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { parseCapture } from "@/lib/capture/parse";
import { guessBadges } from "@/lib/capture/format";
import type { InboxItem } from "@/lib/inbox/repo";

const FADE_MS = 300; // 처리 후 0.3초 페이드 아웃 (§0.4)
const UNDO_MS = 5000; // 삭제 5초 되돌리기 (§0.4)
const SOURCE_ICONS: Record<string, string> = { web: "🌐", bookmarklet: "🔖", mobile: "📱" };

interface UndoEntry {
  item: InboxItem;
  expiresAt: number;
}

export function InboxList({ initialItems }: { initialItems: InboxItem[] }) {
  const router = useRouter();
  const [items, setItems] = useState(initialItems);
  const [leavingIds, setLeavingIds] = useState<Set<string>>(new Set());
  const [undoQueue, setUndoQueue] = useState<UndoEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const timersRef = useRef(new Map<string, ReturnType<typeof setTimeout>>());

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
    async (id: string) => {
      setError(null);
      const res = await fetch(`/api/inbox/${id}/process`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ as: "task" }),
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
      setUndoQueue((prev) => [...prev, { item, expiresAt: Date.now() + UNDO_MS }]);
      timersRef.current.set(
        id,
        setTimeout(() => {
          setUndoQueue((prev) => prev.filter((e) => e.item.id !== id));
          timersRef.current.delete(id);
        }, UNDO_MS),
      );
      router.refresh();
    },
    [removeWithFade, router],
  );

  const handleUndo = useCallback(
    async (entry: UndoEntry) => {
      const timer = timersRef.current.get(entry.item.id);
      if (timer) clearTimeout(timer);
      timersRef.current.delete(entry.item.id);
      setUndoQueue((prev) => prev.filter((e) => e.item.id !== entry.item.id));

      const res = await fetch(`/api/inbox/${entry.item.id}/restore`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(entry.item),
      }).catch(() => null);
      if (!res?.ok) {
        setError("되돌리지 못했습니다");
        return;
      }
      setItems((prev) =>
        [...prev, entry.item].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
      );
      router.refresh();
    },
    [router],
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
            const badges = guessBadges(parseCapture(item.rawText));
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
                  <button
                    onClick={() => handleProcess(item.id)}
                    className="rounded-md border border-ink px-2.5 py-1 text-xs font-medium hover:bg-surface-2"
                  >
                    ✓ 할 일로
                  </button>
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

      {undoQueue.length > 0 && (
        <div className="fixed bottom-5 left-1/2 z-50 flex -translate-x-1/2 flex-col gap-2">
          {undoQueue.map((entry) => (
            <div
              key={entry.item.id}
              className="flex items-center gap-3 rounded-lg border border-line bg-surface px-4 py-2.5 text-xs shadow-lg"
            >
              <span className="max-w-56 truncate text-muted">삭제됨 — {entry.item.rawText}</span>
              <button
                onClick={() => handleUndo(entry)}
                className="font-medium text-ink underline underline-offset-2"
              >
                되돌리기
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
