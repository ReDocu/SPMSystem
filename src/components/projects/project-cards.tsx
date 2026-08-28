"use client";

import { useState } from "react";
import Link from "next/link";
import { STATUS_GROUPS, STATUS_LABELS, type ProjectGroup } from "@/lib/projects/model";
import type { ProjectCard } from "@/lib/projects/repo";
import { formatGuessDate } from "@/lib/capture/format";

const GROUP_ORDER: ProjectGroup[] = ["진행중", "대기중", "완료", "폐기"];
const COLLAPSED_DEFAULT: ProjectGroup[] = ["완료", "폐기"];

const hours = (min: number) => (Number.isInteger(min / 60) ? `${min / 60}h` : `${(min / 60).toFixed(1)}h`);

// 4개 관리 그룹 — 진행중 → 대기중 → 완료(접힘) → 폐기(접힘) (§5-1)
export function ProjectCards({ cards }: { cards: ProjectCard[] }) {
  const [open, setOpen] = useState<Set<ProjectGroup>>(
    new Set(GROUP_ORDER.filter((g) => !COLLAPSED_DEFAULT.includes(g))),
  );

  const toggle = (group: ProjectGroup) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(group)) next.delete(group);
      else next.add(group);
      return next;
    });

  return (
    <div className="flex flex-col gap-3">
      {GROUP_ORDER.map((group) => {
        const items = cards.filter((c) => STATUS_GROUPS[group].includes(c.status));
        if (items.length === 0) return null;
        const isOpen = open.has(group);
        const isWaiting = group === "대기중";
        // 배지는 상시 표시가 원칙 (USE-07) — 그룹이 접혀 있어도 헤더에서 보이게 한다
        const retroMissing =
          group === "완료" || group === "폐기" ? items.filter((c) => !c.hasRetro).length : 0;
        return (
          <section key={group}>
            <button
              onClick={() => toggle(group)}
              className="mb-1.5 flex items-center gap-1.5 text-[13px] font-bold"
            >
              {isOpen ? "▾" : "▸"} {group} ({items.length})
              {retroMissing > 0 && (
                <span className="rounded-full border border-line bg-surface-2 px-2 text-[11px] font-normal text-muted">
                  회고 미작성 {retroMissing}
                </span>
              )}
            </button>
            {isOpen && (
              <ul className="flex flex-col gap-2">
                {items.map((card) => (
                  <li key={card.id}>
                    <Link
                      href={`/projects/${card.id}`}
                      className="flex flex-col gap-1.5 rounded-xl border border-line bg-surface px-4 py-3 transition-colors hover:border-primary"
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className="h-2.5 w-2.5 flex-none rounded-full"
                          style={{ backgroundColor: card.color ?? "#999" }}
                        />
                        <span className="min-w-0 flex-1 truncate text-sm font-medium">
                          {card.title}
                        </span>
                        {isWaiting && (
                          <span className="flex-none rounded-full border border-line bg-surface-2 px-2 text-[11px] text-muted">
                            {STATUS_LABELS[card.status]}
                          </span>
                        )}
                        {/* 상시 배지의 유일한 예외 — 회고는 이 도구의 존재 이유. 중립 회색 (USE-07) */}
                        {(group === "완료" || group === "폐기") && !card.hasRetro && (
                          <span className="flex-none rounded-full border border-line bg-surface-2 px-2 text-[11px] text-muted">
                            회고 미작성
                          </span>
                        )}
                        {!isWaiting && group === "진행중" && (
                          <span className="flex-none text-[11px] text-muted">{card.progress}%</span>
                        )}
                      </div>
                      {/* 대기중은 진행률 바 숨김 — 항상 0%인 빈 바 방지 (ISSUE-08) */}
                      {!isWaiting && group === "진행중" && (
                        <div className="h-1 overflow-hidden rounded-full bg-surface-2">
                          <div
                            className="h-full rounded-full"
                            style={{ width: `${card.progress}%`, backgroundColor: card.color ?? "#999" }}
                          />
                        </div>
                      )}
                      <div className="flex items-center gap-3 text-[11px] text-muted">
                        {card.lastActivityAt && (
                          <span>최근 활동 {formatGuessDate(card.lastActivityAt.slice(0, 10))}</span>
                        )}
                        {card.weekMin > 0 && <span>이번 주 {hours(card.weekMin)}</span>}
                        {card.description && (
                          <span className="min-w-0 flex-1 truncate">{card.description}</span>
                        )}
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        );
      })}
    </div>
  );
}
