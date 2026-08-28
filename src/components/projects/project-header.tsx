"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  gateOf,
  STATUS_LABELS,
  TRANSITIONS,
  type Project,
  type ProjectStatus,
} from "@/lib/projects/model";
import { GateCard } from "@/components/projects/gate-card";

const NEXT_LABELS: Partial<Record<ProjectStatus, string>> = {
  planning: "planning으로 →",
  active: "active로 →",
  live: "live로 →",
  completed: "완료로 →",
  paused: "일시정지",
  dropped: "폐기",
};

// 상세 헤더 — 색 도트·제목·상태 + 전이 버튼 (§5-2 ①). 게이트가 있으면 카드, 없으면 즉시 전이
export function ProjectHeader({ project }: { project: Project }) {
  const router = useRouter();
  const [gateTo, setGateTo] = useState<ProjectStatus | null>(null);
  const [error, setError] = useState(false);

  const nexts = TRANSITIONS[project.status];
  const primary = nexts.find((s) => !["dropped", "paused"].includes(s));
  const secondaries = nexts.filter((s) => s !== primary);

  const handleTransition = async (to: ProjectStatus) => {
    if (gateOf(project.status, to)) {
      setGateTo(to);
      return;
    }
    setError(false);
    const res = await fetch(`/api/projects/${project.id}/transition`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ to }),
    }).catch(() => null);
    if (!res?.ok) {
      setError(true);
      return;
    }
    router.refresh();
  };

  return (
    <header className="flex items-center gap-2.5">
      <span
        className="h-3 w-3 flex-none rounded-full"
        style={{ backgroundColor: project.color ?? "#999" }}
      />
      <h1 className="min-w-0 truncate text-lg font-bold">{project.title}</h1>
      <span className="flex-none rounded-full border border-line bg-surface-2 px-2 py-0.5 text-[11px] text-muted">
        {STATUS_LABELS[project.status]}
      </span>
      <span className="flex-1" />
      {error && <span className="text-[11px] text-muted">전이 실패</span>}
      {primary && (
        <button
          onClick={() => handleTransition(primary)}
          className="flex-none rounded-md border border-ink px-3 py-1.5 text-xs font-medium hover:bg-surface-2"
        >
          {NEXT_LABELS[primary] ?? `${primary}로 →`}
        </button>
      )}
      {secondaries.map((s) => (
        <button
          key={s}
          onClick={() => handleTransition(s)}
          className="flex-none rounded-md border border-line px-2.5 py-1.5 text-xs text-muted hover:text-ink"
        >
          {s === "active" ? "다시 진행" : (NEXT_LABELS[s] ?? s)}
        </button>
      ))}

      {gateTo && <GateCard project={project} to={gateTo} onClose={() => setGateTo(null)} />}
    </header>
  );
}
