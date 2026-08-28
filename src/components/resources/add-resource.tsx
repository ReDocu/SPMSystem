"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type Status = "idle" | "saving" | "saved-idea" | "error";

// [+] 등록 — URL이면 사이트(메타 자동 추출), 그 외 텍스트면 아이디어 (인박스 규칙과 동일)
// 카테고리 필터로 보고 있으면 그 카테고리로 저장한다 (저장 후 안 보이는 문제 방지)
export function AddResource({
  isIdeaView,
  category,
}: {
  isIdeaView: boolean;
  category?: string;
}) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [status, setStatus] = useState<Status>("idle");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed || status === "saving") return;

    const isUrl = /^https?:\/\//i.test(trimmed);
    const isIdea = isIdeaView || !isUrl;
    const body = isIdea
      ? { type: "idea", content: trimmed }
      : { type: "site", url: trimmed, category: category ?? null };

    setStatus("saving");
    const res = await fetch("/api/resources", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).catch(() => null);

    if (!res?.ok) {
      setStatus("error");
      return;
    }
    setText("");
    // 사이트 뷰에서 아이디어를 저장하면 현재 목록에 안 보인다 — 어디로 갔는지 알려준다
    setStatus(isIdea && !isIdeaView ? "saved-idea" : "idle");
    router.refresh();
  };

  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-2">
      <input
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          if (status === "error" || status === "saved-idea") setStatus("idle");
        }}
        placeholder={
          isIdeaView
            ? "+ 떠오르는 생각을 적어두세요 (Enter)"
            : "+ URL 붙여넣기 (제목·썸네일 자동) 또는 아이디어 텍스트 (Enter)"
        }
        className="min-w-0 flex-1 rounded-md border border-dashed border-line bg-surface px-3 py-2 text-xs outline-none placeholder:text-muted focus:border-primary"
      />
      {status === "saving" && <span className="flex-none text-[11px] text-muted">저장 중…</span>}
      {status === "saved-idea" && (
        <Link href="/resources?type=idea" className="flex-none text-[11px] text-muted underline underline-offset-2 hover:text-ink">
          아이디어로 저장됨 ✓ — 보러 가기
        </Link>
      )}
      {status === "error" && (
        <span className="flex-none text-[11px] text-muted">저장 실패 — 다시 시도해주세요</span>
      )}
    </form>
  );
}
