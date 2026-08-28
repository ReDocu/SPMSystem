"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatGuessDate } from "@/lib/capture/format";
import type { Task } from "@/lib/schedule/repo";

interface TaskPanelProps {
  date: string; // 열람 중인 날짜 — 인라인 추가는 이 날짜로
  today: string; // 실제 오늘 — "오늘로" 재선정은 열람일이 아니라 이 날짜로
  planned: Task[];
  missed: Task[];
  backlog: Task[];
}

// 우측 패널 — 오늘 할 일(체크·인라인 추가) + 못 한 일(재선정/반환) + 백로그(오늘로) (§4-1 ⑤⑥⑦)
export function TaskPanel({ date, today, planned, missed, backlog }: TaskPanelProps) {
  const router = useRouter();
  const [newTitle, setNewTitle] = useState("");
  const [missedOpen, setMissedOpen] = useState(false);
  const [backlogOpen, setBacklogOpen] = useState(false);

  const patchTask = async (id: string, body: object) => {
    const res = await fetch(`/api/tasks/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).catch(() => null);
    if (res?.ok) router.refresh();
  };

  const handleAdd = async () => {
    const title = newTitle.trim();
    if (!title) return;
    const res = await fetch("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, plannedDate: date }),
    }).catch(() => null);
    if (res?.ok) {
      setNewTitle("");
      router.refresh();
    }
  };

  return (
    <>
      <section className="rounded-lg border border-line bg-surface p-3.5">
        <h2 className="mb-2 text-[13px] font-bold">오늘 할 일</h2>
        {planned.length === 0 && (
          <p className="mb-1.5 text-xs text-muted">아직 없음 — 아래에 추가하거나 백로그에서 끌어오세요</p>
        )}
        <ul className="flex flex-col gap-1">
          {planned.map((task) => (
            <li key={task.id} className="flex items-center gap-2 text-[13px]">
              <input
                type="checkbox"
                checked={task.status === "done"}
                onChange={() =>
                  patchTask(task.id, { status: task.status === "done" ? "todo" : "done" })
                }
                className="accent-current"
              />
              <span className={task.status === "done" ? "text-muted line-through" : ""}>
                {task.title}
              </span>
            </li>
          ))}
        </ul>
        <input
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleAdd()}
          placeholder="+ 할 일 추가 (Enter)"
          className="mt-2 w-full rounded-md border border-dashed border-line bg-transparent px-2 py-1.5 text-xs outline-none placeholder:text-muted focus:border-primary"
        />
      </section>

      <section className="rounded-lg border border-dashed border-line px-3.5 py-2 text-[13px]">
        <button onClick={() => setMissedOpen(!missedOpen)} className="w-full text-left text-muted hover:text-ink">
          {missedOpen ? "▾" : "▸"} 못 한 일 ({missed.length})
        </button>
        {missedOpen && missed.length > 0 && (
          <ul className="mt-2 flex flex-col gap-1.5">
            {missed.map((task) => (
              <li key={task.id} className="flex items-center gap-2 text-xs">
                <span className="min-w-0 flex-1 truncate">{task.title}</span>
                {task.plannedDate && (
                  <span className="flex-none text-[10px] text-red-400">
                    {formatGuessDate(task.plannedDate)}
                  </span>
                )}
                <button
                  onClick={() => patchTask(task.id, { plannedDate: today })}
                  className="flex-none rounded border border-line px-1.5 py-0.5 text-[11px] hover:border-ink"
                >
                  오늘로
                </button>
                <button
                  onClick={() => patchTask(task.id, { plannedDate: null })}
                  className="flex-none rounded border border-line px-1.5 py-0.5 text-[11px] text-muted hover:text-ink"
                >
                  백로그로
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-lg border border-dashed border-line px-3.5 py-2 text-[13px]">
        <button onClick={() => setBacklogOpen(!backlogOpen)} className="w-full text-left text-muted hover:text-ink">
          {backlogOpen ? "▾" : "▸"} 백로그 ({backlog.length})
        </button>
        {backlogOpen && (
          <ul className="mt-2 flex flex-col gap-1.5">
            {backlog.length === 0 && <li className="text-xs text-muted">비어 있음</li>}
            {backlog.map((task) => (
              <li key={task.id} className="flex items-center gap-2 text-xs">
                <span className="min-w-0 flex-1 truncate">{task.title}</span>
                {task.projectTitle && (
                  <span className="flex-none rounded-full border border-line bg-surface-2 px-1.5 text-[10px] text-muted">
                    #{task.projectTitle}
                  </span>
                )}
                <button
                  onClick={() => patchTask(task.id, { plannedDate: today })}
                  className="flex-none rounded border border-line px-1.5 py-0.5 text-[11px] hover:border-ink"
                >
                  오늘로
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
