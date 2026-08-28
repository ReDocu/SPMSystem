"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// G0 씨앗 — 제목(유일한 필수) + 한 줄 메모, 마찰 없이 (상세기획 §2.1)
export function NewProject() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [memo, setMemo] = useState("");
  const [error, setError] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) return;
    setError(false);
    const res = await fetch("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: trimmed, description: memo.trim() || null }),
    }).catch(() => null);
    if (!res?.ok) {
      setError(true);
      return;
    }
    setTitle("");
    setMemo("");
    router.refresh();
  };

  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-2">
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="+ 새 프로젝트 제목"
        className="w-52 flex-none rounded-md border border-dashed border-line bg-surface px-3 py-2 text-xs outline-none placeholder:text-muted focus:border-primary"
      />
      <input
        value={memo}
        onChange={(e) => setMemo(e.target.value)}
        placeholder="한 줄 메모 (선택) — Enter로 씨앗 등록"
        className="min-w-0 flex-1 rounded-md border border-dashed border-line bg-surface px-3 py-2 text-xs outline-none placeholder:text-muted focus:border-primary"
      />
      {error && <span className="flex-none text-[11px] text-muted">저장 실패</span>}
    </form>
  );
}
