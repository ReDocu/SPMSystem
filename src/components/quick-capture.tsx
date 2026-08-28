"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { parseCapture } from "@/lib/capture/parse";
import { guessBadges } from "@/lib/capture/format";

type Status = "idle" | "saving" | "saved" | "error";

// 런처 하단 빠른 입력 (화면명세서 §2 ②) — 추정 미리보기 + Enter 저장, 확인 단계 없음
export function QuickCapture() {
  const router = useRouter();
  const [text, setText] = useState("");
  const [status, setStatus] = useState<Status>("idle");

  const badges = useMemo(() => {
    const trimmed = text.trim();
    return trimmed ? guessBadges(parseCapture(trimmed)) : [];
  }, [text]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed || status === "saving") return;

    setStatus("saving");
    const res = await fetch("/api/inbox", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: trimmed, source: "web" }),
    }).catch(() => null);

    if (!res?.ok) {
      setStatus("error");
      return;
    }
    setText("");
    setStatus("saved");
    setTimeout(() => setStatus((s) => (s === "saved" ? "idle" : s)), 1500);
    router.refresh();
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-1.5">
      <div className="flex items-center gap-3 rounded-xl border border-line bg-surface px-5 py-3.5 focus-within:border-primary">
        <span className="text-sm text-muted">&gt;</span>
        <input
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            if (status !== "idle") setStatus("idle");
          }}
          placeholder="빠른 입력 — 무엇이든 던져두세요"
          className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted"
        />
        <span className="flex-none rounded-full border border-line px-2 py-0.5 text-[11px] text-muted">
          ⏎
        </span>
      </div>
      <div className="flex min-h-5 items-center gap-1.5 px-2 text-[11px]">
        {status === "saved" && <span className="text-muted">인박스에 저장됨 ✓</span>}
        {status === "error" && (
          <span className="text-muted">저장하지 못했습니다 — 다시 Enter를 눌러주세요</span>
        )}
        {status === "idle" &&
          badges.map((badge) => (
            <span
              key={badge}
              className="rounded-full border border-line bg-surface-2 px-2 py-0.5 text-muted"
            >
              {badge}
            </span>
          ))}
        {status === "idle" && badges.length > 0 && (
          <span className="text-muted">↵ 인박스에 저장</span>
        )}
      </div>
    </form>
  );
}
