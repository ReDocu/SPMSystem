"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { DailyNote } from "@/lib/schedule/repo";

// 컨디션 1~4 (daily_notes.condition check 제약과 일치)
const CONDITIONS = [
  { value: 4, emoji: "😀" },
  { value: 3, emoji: "🙂" },
  { value: 2, emoji: "😐" },
  { value: 1, emoji: "🙁" },
];

// 데일리 노트 — 한 줄 입력(blur/Enter 저장) + 컨디션 이모지 1탭 (§4-1 ⑨⑩)
export function DailyNotePanel({ date, note }: { date: string; note: DailyNote }) {
  const router = useRouter();
  const [content, setContent] = useState(note.content ?? "");
  const [saved, setSaved] = useState(false);

  const put = async (body: object) => {
    const res = await fetch(`/api/daily-notes/${date}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).catch(() => null);
    if (res?.ok) router.refresh();
    return res?.ok ?? false;
  };

  const saveContent = async () => {
    if (content.trim() === (note.content ?? "")) return;
    if (await put({ content: content.trim() || null })) {
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    }
  };

  return (
    <section className="rounded-lg border border-line bg-surface p-3.5">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-[13px] font-bold">데일리 노트</h2>
        {saved && <span className="text-[10px] text-muted">저장됨 ✓</span>}
      </div>
      <input
        value={content}
        onChange={(e) => setContent(e.target.value)}
        onBlur={saveContent}
        onKeyDown={(e) => e.key === "Enter" && saveContent()}
        placeholder="오늘 한 줄 (선택)"
        className="w-full rounded-md border border-dashed border-line bg-transparent px-2 py-1.5 text-xs outline-none placeholder:text-muted focus:border-primary"
      />
      <div className="mt-2.5 flex items-center gap-1.5">
        <span className="text-[11px] text-muted">컨디션</span>
        {CONDITIONS.map(({ value, emoji }) => (
          <button
            key={value}
            onClick={() => put({ condition: note.condition === value ? null : value })}
            className={`rounded-md px-1 text-base leading-7 transition-opacity ${
              note.condition === value
                ? "bg-surface-2 opacity-100"
                : note.condition
                  ? "opacity-40 hover:opacity-100"
                  : "opacity-70 hover:opacity-100"
            }`}
          >
            {emoji}
          </button>
        ))}
      </div>
    </section>
  );
}
