"use client";

/* eslint-disable @next/next/no-img-element -- 썸네일·파비콘은 외부 URL 직접 참조 (서버 복사 금지 원칙) */

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { DEFAULT_CATEGORIES, type Resource } from "@/lib/resources/model";
import { faviconUrl, hostOf } from "@/lib/resources/meta";
import { UndoToasts, useUndoQueue, type UndoEntry } from "@/components/undo-toast";

// 사이트 카드 그리드 + 아이디어 리스트. 삭제는 즉시 + 5초 되돌리기, 카테고리는 카드에서 후처리
export function ResourceList({
  items,
  isIdeaView,
  hasSearch,
}: {
  items: Resource[];
  isIdeaView: boolean;
  hasSearch: boolean;
}) {
  const router = useRouter();
  const undoQueue = useUndoQueue<Resource>();
  const [error, setError] = useState<string | null>(null);

  const handleDelete = async (item: Resource) => {
    setError(null);
    const res = await fetch(`/api/resources/${item.id}`, { method: "DELETE" }).catch(() => null);
    if (!res?.ok) {
      setError("삭제하지 못했습니다 — 다시 시도해주세요");
      return;
    }
    const { item: deleted } = (await res.json()) as { item: Resource };
    undoQueue.push({ key: deleted.id, label: deleted.title, payload: deleted });
    router.refresh();
  };

  const handleUndo = async (entry: UndoEntry<Resource>) => {
    const restoring = undoQueue.take(entry);
    const res = await fetch(`/api/resources/${restoring.id}/restore`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(restoring),
    }).catch(() => null);
    if (!res?.ok) setError("되돌리지 못했습니다");
    router.refresh();
  };

  const handleCategory = async (item: Resource, category: string) => {
    setError(null);
    const res = await fetch(`/api/resources/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ category }),
    }).catch(() => null);
    if (!res?.ok) {
      setError("카테고리를 바꾸지 못했습니다");
      return;
    }
    router.refresh();
  };

  const errorBanner = error && (
    <p className="rounded-md border border-line bg-surface-2 px-3 py-2 text-xs text-muted">{error}</p>
  );

  if (items.length === 0) {
    return (
      <>
        {errorBanner}
        <div className="rounded-xl border border-line bg-surface p-10 text-center text-sm text-muted">
          {hasSearch
            ? "검색 결과가 없습니다"
            : isIdeaView
              ? "떠오르는 생각을 ⌘K로 던져두세요"
              : "북마클릿을 설치해보세요 — 설정 › 북마클릿"}
        </div>
      </>
    );
  }

  return (
    <>
      {errorBanner}
      {isIdeaView ? (
        <ul className="overflow-hidden rounded-xl border border-line bg-surface">
          {items.map((item) => (
            <li key={item.id} className="group flex items-center gap-3 border-b border-line/50 px-4 py-3 last:border-b-0">
              <Link href={`/resources/${item.id}`} className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{item.title}</p>
                {item.content && item.content !== item.title && (
                  <p className="truncate text-xs text-muted">{item.content.split("\n")[0]}</p>
                )}
              </Link>
              <button
                onClick={() => handleDelete(item)}
                className="flex-none rounded border border-line px-2 py-0.5 text-[11px] text-muted opacity-0 hover:text-ink group-hover:opacity-100"
              >
                삭제
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => {
            const host = item.url ? hostOf(item.url) : null;
            const favicon = item.url ? faviconUrl(item.url) : null;
            return (
              <div
                key={item.id}
                className="group flex flex-col overflow-hidden rounded-xl border border-line bg-surface transition-colors hover:border-primary"
              >
                <a href={item.url ?? "#"} target="_blank" rel="noopener noreferrer" className="block">
                  {item.thumbnail ? (
                    <img
                      src={item.thumbnail}
                      alt=""
                      loading="lazy"
                      className="h-28 w-full border-b border-line/50 object-cover"
                    />
                  ) : (
                    <div className="flex h-28 w-full items-center justify-center border-b border-line/50 bg-surface-2 text-xs text-muted">
                      {host ?? "사이트"}
                    </div>
                  )}
                  <div className="flex flex-col gap-1 px-3.5 pb-2 pt-2.5">
                    <div className="flex items-center gap-1.5 text-[11px] text-muted">
                      {favicon && <img src={favicon} alt="" className="h-3.5 w-3.5" loading="lazy" />}
                      <span className="truncate">{host}</span>
                    </div>
                    <p className="line-clamp-2 text-sm font-medium">{item.title}</p>
                    {item.memo && <p className="truncate text-xs text-muted">{item.memo}</p>}
                  </div>
                </a>
                <div className="mt-auto flex items-center gap-1.5 px-3.5 pb-2.5">
                  <select
                    value={item.category ?? "기타"}
                    onChange={(e) => handleCategory(item, e.target.value)}
                    className="rounded border border-line bg-surface px-1 py-0.5 text-[11px] text-muted"
                  >
                    {DEFAULT_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                  <span className="flex-1" />
                  <Link
                    href={`/resources/${item.id}`}
                    className="rounded border border-line px-2 py-0.5 text-[11px] text-muted opacity-0 hover:text-ink group-hover:opacity-100"
                  >
                    편집
                  </Link>
                  <button
                    onClick={() => handleDelete(item)}
                    className="rounded border border-line px-2 py-0.5 text-[11px] text-muted opacity-0 hover:text-ink group-hover:opacity-100"
                  >
                    삭제
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <UndoToasts entries={undoQueue.entries} onUndo={handleUndo} />
    </>
  );
}
