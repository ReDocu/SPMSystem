"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { DEFAULT_CATEGORIES, type Resource } from "@/lib/resources/model";

type Status = "idle" | "saving" | "saved" | "error";

// 아이디어: 제목 + 마크다운 본문 / 사이트: 제목 + 메모 + 카테고리. [프로젝트로 승격]은 v0.3
export function ResourceEditor({ item }: { item: Resource }) {
  const router = useRouter();
  const isSite = item.type === "site";
  const [title, setTitle] = useState(item.title);
  const [text, setText] = useState((isSite ? item.memo : item.content) ?? "");
  const [category, setCategory] = useState(item.category ?? "기타");
  const [status, setStatus] = useState<Status>("idle");

  const handleSave = async () => {
    if (status === "saving") return;
    setStatus("saving");
    const patch: Record<string, unknown> = { title: title.trim() || item.title };
    if (isSite) {
      patch.memo = text.trim() || null;
      patch.category = category;
    } else {
      patch.content = text || null;
    }
    const res = await fetch(`/api/resources/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    }).catch(() => null);
    if (!res?.ok) {
      setStatus("error");
      return;
    }
    setStatus("saved");
    setTimeout(() => setStatus((s) => (s === "saved" ? "idle" : s)), 1500);
    router.refresh();
  };

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4">
      <header className="flex items-center justify-between">
        <Link href="/resources" className="text-xs text-muted hover:text-ink">
          ← 자료수집
        </Link>
        <div className="flex items-center gap-2">
          {status === "saved" && <span className="text-[11px] text-muted">저장됨 ✓</span>}
          {status === "error" && (
            <span className="text-[11px] text-muted">저장 실패 — 다시 시도해주세요</span>
          )}
          <button
            onClick={handleSave}
            className="rounded-md border border-ink px-3 py-1.5 text-xs font-medium hover:bg-surface-2"
          >
            저장
          </button>
        </div>
      </header>

      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        className="rounded-md border border-line bg-surface px-3 py-2 text-base font-bold outline-none focus:border-primary"
      />

      {isSite && (
        <div className="flex items-center gap-3 text-xs text-muted">
          <a
            href={item.url ?? "#"}
            target="_blank"
            rel="noopener noreferrer"
            className="truncate underline underline-offset-2 hover:text-ink"
          >
            {item.url}
          </a>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="flex-none rounded border border-line bg-surface px-1.5 py-1"
          >
            {DEFAULT_CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </div>
      )}

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={isSite ? 3 : 16}
        placeholder={isSite ? "한 줄 메모" : "마크다운 메모"}
        className="resize-y rounded-md border border-line bg-surface px-3 py-2 font-mono text-[13px] leading-relaxed outline-none focus:border-primary"
      />
    </div>
  );
}
