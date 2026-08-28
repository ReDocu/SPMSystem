"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { KanbanTask, Milestone } from "@/lib/projects/model";
import { formatGuessDate } from "@/lib/capture/format";
import { toDateKey } from "@/lib/dates";
import { UndoToasts, useUndoQueue } from "@/components/undo-toast";

interface DeletedMilestone {
  milestone: Milestone;
  taskIds: string[];
}

const COLUMNS = ["todo", "doing", "done"] as const;
type Column = (typeof COLUMNS)[number];

// 칸반 3열 + dropped 접힘 + 마일스톤 관리 (§5-3). 이동은 ◀▶ 버튼 (드래그는 후속)
export function KanbanTab({
  projectId,
  tasks,
  milestones,
}: {
  projectId: string;
  tasks: KanbanTask[];
  milestones: Milestone[];
}) {
  const router = useRouter();
  const [newTitle, setNewTitle] = useState("");
  const [newMilestone, setNewMilestone] = useState("");
  const [droppedOpen, setDroppedOpen] = useState(false);
  const [msOpen, setMsOpen] = useState(false);
  const [msTitle, setMsTitle] = useState("");
  const [msDue, setMsDue] = useState("");
  const undoQueue = useUndoQueue<DeletedMilestone>();

  const msName = (id: string | null) => milestones.find((m) => m.id === id)?.title ?? null;

  const patchTask = async (id: string, body: object) => {
    const res = await fetch(`/api/tasks/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).catch(() => null);
    if (res?.ok) router.refresh();
  };

  const addTask = async () => {
    const title = newTitle.trim();
    if (!title) return;
    const res = await fetch(`/api/projects/${projectId}/tasks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, milestoneId: newMilestone || null }),
    }).catch(() => null);
    if (res?.ok) {
      setNewTitle("");
      router.refresh();
    }
  };

  const addMilestone = async () => {
    const title = msTitle.trim();
    if (!title) return;
    const res = await fetch(`/api/projects/${projectId}/milestones`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, dueDate: msDue || null }),
    }).catch(() => null);
    if (res?.ok) {
      setMsTitle("");
      setMsDue("");
      router.refresh();
    }
  };

  const move = (task: KanbanTask, dir: -1 | 1) => {
    const idx = COLUMNS.indexOf(task.status as Column);
    const next = COLUMNS[idx + dir];
    if (next) patchTask(task.id, { status: next });
  };

  const dropped = tasks.filter((t) => t.status === "dropped");
  const today = toDateKey(new Date());

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <input
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && addTask()}
          placeholder="+ 태스크 추가 (Enter)"
          className="min-w-0 flex-1 rounded-md border border-dashed border-line bg-surface px-3 py-2 text-xs outline-none placeholder:text-muted focus:border-primary"
        />
        {milestones.length > 0 && (
          <select
            value={newMilestone}
            onChange={(e) => setNewMilestone(e.target.value)}
            className="flex-none rounded-md border border-line bg-surface px-2 py-2 text-[11px] text-muted"
          >
            <option value="">마일스톤 없음</option>
            {milestones.map((ms) => (
              <option key={ms.id} value={ms.id}>
                ◆ {ms.title}
              </option>
            ))}
          </select>
        )}
        <button
          onClick={() => setMsOpen(!msOpen)}
          className="flex-none rounded-md border border-line px-2.5 py-2 text-[11px] text-muted hover:text-ink"
        >
          ◆ 마일스톤 관리
        </button>
      </div>

      {msOpen && (
        <section className="flex flex-col gap-2 rounded-xl border border-line bg-surface p-3.5">
          {milestones.map((ms) => (
            <div key={ms.id} className="flex items-center gap-2 text-xs">
              <span className="min-w-0 flex-1 truncate">◆ {ms.title}</span>
              {ms.dueDate && <span className="flex-none text-muted">{formatGuessDate(ms.dueDate)}</span>}
              <span className="flex-none text-[11px] text-muted">가중 {ms.weight}</span>
              <button
                onClick={async () => {
                  // 즉시 삭제 + 5초 되돌리기 — 풀린 태스크 연결까지 복원 (공통 규칙 §0.4)
                  const res = await fetch(`/api/milestones/${ms.id}`, { method: "DELETE" }).catch(() => null);
                  if (!res?.ok) return;
                  const deleted = (await res.json()) as DeletedMilestone;
                  undoQueue.push({ key: ms.id, label: ms.title, payload: deleted });
                  router.refresh();
                }}
                className="flex-none rounded border border-line px-1.5 py-0.5 text-[11px] text-muted hover:text-ink"
              >
                삭제
              </button>
            </div>
          ))}
          <div className="flex items-center gap-2">
            <input
              value={msTitle}
              onChange={(e) => setMsTitle(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addMilestone()}
              placeholder="+ 마일스톤 (Enter)"
              className="min-w-0 flex-1 rounded-md border border-dashed border-line bg-transparent px-2.5 py-1.5 text-xs outline-none placeholder:text-muted focus:border-primary"
            />
            <input
              type="date"
              value={msDue}
              onChange={(e) => setMsDue(e.target.value)}
              className="flex-none rounded-md border border-line bg-surface px-2 py-1.5 text-xs"
            />
          </div>
        </section>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {COLUMNS.map((col) => {
          const items = tasks.filter((t) => t.status === col);
          return (
            <section key={col} className="flex flex-col gap-2">
              <h2 className="text-[13px] font-bold">
                {col} <span className="font-normal text-muted">({items.length})</span>
              </h2>
              {items.map((task) => (
                <div
                  key={task.id}
                  className="flex flex-col gap-1.5 rounded-lg border border-line bg-surface px-3 py-2.5"
                >
                  <p className="text-xs font-medium">{task.title}</p>
                  <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-muted">
                    {task.dueDate && (
                      <span className={task.dueDate < today ? "text-red-400" : ""}>
                        {formatGuessDate(task.dueDate)} 마감
                      </span>
                    )}
                    {msName(task.milestoneId) && (
                      <span className="rounded-full border border-line bg-surface-2 px-1.5">
                        ◆ {msName(task.milestoneId)}
                      </span>
                    )}
                    <span className="flex-1" />
                    {col !== "todo" && (
                      <button onClick={() => move(task, -1)} className="hover:text-ink">◀</button>
                    )}
                    {col !== "done" && (
                      <button onClick={() => move(task, 1)} className="hover:text-ink">▶</button>
                    )}
                    {col !== "done" && task.plannedDate !== today && (
                      <button
                        onClick={() => patchTask(task.id, { plannedDate: today })}
                        className="rounded border border-line px-1.5 hover:border-ink"
                      >
                        오늘 하기
                      </button>
                    )}
                    <button
                      onClick={() => patchTask(task.id, { status: "dropped" })}
                      className="hover:text-ink"
                      title="폐기 (삭제 아님 — 회고 원재료)"
                    >
                      ⌫
                    </button>
                  </div>
                </div>
              ))}
              {items.length === 0 && (
                <div className="rounded-lg border border-dashed border-line px-3 py-4 text-center text-[11px] text-muted">
                  비어 있음
                </div>
              )}
            </section>
          );
        })}
      </div>

      <section className="rounded-lg border border-dashed border-line px-3.5 py-2 text-[13px]">
        <button onClick={() => setDroppedOpen(!droppedOpen)} className="text-muted hover:text-ink">
          {droppedOpen ? "▾" : "▸"} dropped ({dropped.length})
        </button>
        {droppedOpen && dropped.length > 0 && (
          <ul className="mt-2 flex flex-col gap-1">
            {dropped.map((task) => (
              <li key={task.id} className="flex items-center gap-2 text-xs text-muted">
                <span className="min-w-0 flex-1 truncate line-through">{task.title}</span>
                <button
                  onClick={() => patchTask(task.id, { status: "todo" })}
                  className="flex-none rounded border border-line px-1.5 py-0.5 text-[11px] hover:text-ink"
                >
                  되살리기
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <UndoToasts
        entries={undoQueue.entries}
        onUndo={async (entry) => {
          const deleted = undoQueue.take(entry);
          await fetch(`/api/milestones/${deleted.milestone.id}/restore`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(deleted),
          }).catch(() => null);
          router.refresh();
        }}
      />
    </div>
  );
}
