"use client";

import { useState } from "react";
import Link from "next/link";
import { kickoffFill, type Milestone, type Project } from "@/lib/projects/model";
import { formatGuessDate } from "@/lib/capture/format";
import { GateCard } from "@/components/projects/gate-card";

interface OverviewProps {
  project: Project;
  time: { totalMin: number; weekMin: number };
  milestones: Milestone[];
  yearGoals: { id: string; title: string; status: string; targetYear: number }[];
}

const hours = (min: number) => (Number.isInteger(min / 60) ? `${min / 60}h` : `${(min / 60).toFixed(1)}h`);

const field = (label: string, value: string | null) => (
  <p className="text-xs">
    <span className="text-muted">{label}: </span>
    {value?.trim() ? value : <span className="text-muted/60">(비어 있음)</span>}
  </p>
);

// 개요 탭 — 게이트에서 채운 것들이 사는 곳 (§5-2). 생애 타임라인은 v0.5
export function OverviewTab({ project, time, milestones, yearGoals }: OverviewProps) {
  const [editOpen, setEditOpen] = useState(false);
  const fill = kickoffFill(project);
  const nextMilestones = milestones.filter((m) => m.dueDate).slice(0, 2);

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <section className="flex flex-col gap-1.5 rounded-xl border border-line bg-surface p-4">
        <div className="mb-1 flex items-center justify-between">
          <h2 className="text-[13px] font-bold">
            킥오프 <span className="font-normal text-muted">({fill.filled}/{fill.total} 채움)</span>
          </h2>
          <button
            onClick={() => setEditOpen(true)}
            className="rounded border border-line px-2 py-0.5 text-[11px] text-muted hover:text-ink"
          >
            게이트 카드 다시 열기
          </button>
        </div>
        {field("목적", project.purpose)}
        {field("타겟", project.targetUser)}
        {field("범위(In)", project.scopeIn)}
        {field("범위(Out)", project.scopeOut)}
      </section>

      <section className="flex flex-col gap-1.5 rounded-xl border border-line bg-surface p-4">
        <h2 className="mb-1 text-[13px] font-bold">스택 · 링크</h2>
        {field("기술스택", project.techStack?.join(" · ") ?? null)}
        <p className="flex gap-3 text-xs">
          {project.repoUrl ? (
            <a href={project.repoUrl} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
              repo ↗
            </a>
          ) : (
            <span className="text-muted/60">repo (비어 있음)</span>
          )}
          {project.deployUrl && (
            <a href={project.deployUrl} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
              deploy ↗
            </a>
          )}
        </p>
        {project.description && field("메모", project.description)}
      </section>

      <section className="flex flex-col gap-1.5 rounded-xl border border-line bg-surface p-4">
        <h2 className="mb-1 text-[13px] font-bold">시간</h2>
        <p className="text-xs">
          총 {hours(time.totalMin)} · 이번 주 {hours(time.weekMin)}
          <span className="ml-1.5 text-[11px] text-muted">
            (타임로그 #{project.title} 집계)
          </span>
        </p>
      </section>

      <section className="flex flex-col gap-1.5 rounded-xl border border-line bg-surface p-4">
        <h2 className="mb-1 text-[13px] font-bold">마일스톤 · 연간 목표</h2>
        {nextMilestones.length === 0 && yearGoals.length === 0 && (
          <p className="text-xs text-muted">아직 없음</p>
        )}
        {nextMilestones.map((ms) => (
          <p key={ms.id} className="text-xs">
            ◆ {ms.title}
            {ms.dueDate && <span className="ml-1.5 text-muted">{formatGuessDate(ms.dueDate)}</span>}
          </p>
        ))}
        {yearGoals.map((goal) => (
          <p key={goal.id} className="text-xs">
            <Link href={`/schedule/year/${goal.targetYear}`} className="hover:underline">
              {goal.status === "done" ? "☑" : "☐"}{" "}
              <span className={goal.status === "done" ? "text-muted line-through" : ""}>
                {goal.title}
              </span>
              <span className="ml-1 text-[11px] text-muted">{goal.targetYear}</span>
            </Link>
          </p>
        ))}
      </section>

      {editOpen && <GateCard project={project} to={null} onClose={() => setEditOpen(false)} />}
    </div>
  );
}
