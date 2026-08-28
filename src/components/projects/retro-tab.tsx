"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Project, Retrospective } from "@/lib/projects/model";
import { formatGuessDate } from "@/lib/capture/format";

const QUESTIONS = [
  { key: "good", label: "1. 잘한 것" },
  { key: "bad", label: "2. 아쉬운 것" },
  { key: "learned", label: "3. 배운 것" },
  { key: "neverAgain", label: "4. 다음에 안 할 것 ★" },
] as const;

const hours = (min: number) => (Number.isInteger(min / 60) ? `${min / 60}h` : `${(min / 60).toFixed(1)}h`);

// 회고 탭 — 4문항 + 자동 수치 스냅샷 (§5.4). 종료 상태에서만 작성·수정
export function RetroTab({ project, retro }: { project: Project; retro: Retrospective | null }) {
  const router = useRouter();
  const isClosed = project.status === "completed" || project.status === "dropped";
  const [fields, setFields] = useState({
    good: retro?.good ?? "",
    bad: retro?.bad ?? "",
    learned: retro?.learned ?? "",
    neverAgain: retro?.neverAgain ?? "",
  });
  const [status, setStatus] = useState<"idle" | "saved" | "error">("idle");

  if (!isClosed) {
    return (
      <div className="rounded-xl border border-line bg-surface p-10 text-center text-sm text-muted">
        프로젝트를 마치면 회고를 작성합니다
      </div>
    );
  }

  const save = async () => {
    setStatus("idle");
    const res = await fetch(`/api/projects/${project.id}/retro`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(fields),
    }).catch(() => null);
    if (!res?.ok) {
      setStatus("error");
      return;
    }
    setStatus("saved");
    setTimeout(() => setStatus((s) => (s === "saved" ? "idle" : s)), 1500);
    router.refresh();
  };

  const stats = retro?.stats;

  return (
    <div className="flex max-w-2xl flex-col gap-3">
      {stats && (
        <div className="rounded-xl border border-line bg-surface-2/60 px-4 py-2.5 text-xs text-muted">
          {stats.from && `기간 ${formatGuessDate(stats.from)} ~ ${formatGuessDate(stats.to)} (${stats.days}일) · `}
          총 투입 {hours(stats.totalMin)} · 완료 태스크 {stats.doneCount} · 드롭 {stats.droppedCount} · 배포 {stats.deployCount}회
          <span className="ml-1.5 opacity-60">(작성 시점 스냅샷)</span>
        </div>
      )}

      {QUESTIONS.map((q) => (
        <label key={q.key} className="flex flex-col gap-1 text-xs">
          <span className={q.key === "neverAgain" ? "font-bold" : "text-muted"}>{q.label}</span>
          <textarea
            value={fields[q.key]}
            onChange={(e) => setFields({ ...fields, [q.key]: e.target.value })}
            rows={3}
            className="resize-y rounded-md border border-line bg-surface px-3 py-2 text-[13px] leading-relaxed outline-none focus:border-primary"
          />
        </label>
      ))}

      <div className="flex items-center justify-end gap-2">
        {status === "saved" && <span className="text-[11px] text-muted">저장됨 ✓</span>}
        {status === "error" && <span className="text-[11px] text-muted">저장 실패 — 다시 시도해주세요</span>}
        <button
          onClick={save}
          className="rounded-md border border-ink px-3 py-1.5 text-xs font-medium hover:bg-surface-2"
        >
          저장
        </button>
      </div>
    </div>
  );
}
