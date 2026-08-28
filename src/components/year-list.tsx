"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Task } from "@/lib/schedule/repo";

// 연별 목표 목록 — 체크·프로젝트로 만들기·인라인 추가 (§4-3). 드래그 정렬은 후속
export function YearList({
  year,
  tasks,
  readOnly,
}: {
  year: number;
  tasks: Task[];
  readOnly: boolean;
}) {
  const router = useRouter();
  const [newTitle, setNewTitle] = useState("");

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
    const res = await fetch("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, targetYear: year }),
    }).catch(() => null);
    if (res?.ok) {
      setNewTitle("");
      router.refresh();
    }
  };

  const promote = async (id: string) => {
    const res = await fetch(`/api/tasks/${id}/promote`, { method: "POST" }).catch(() => null);
    if (res?.ok) {
      const { projectId } = (await res.json()) as { projectId: string };
      router.push(`/projects/${projectId}`);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      {tasks.length === 0 ? (
        <div className="rounded-xl border border-line bg-surface p-10 text-center text-sm text-muted">
          올해 하고 싶은 일을 적어보세요
        </div>
      ) : (
        <ul className="overflow-hidden rounded-xl border border-line bg-surface">
          {tasks.map((task) => {
            const isClosed = task.status === "done" || task.status === "dropped";
            return (
              <li
                key={task.id}
                className="group flex items-center gap-2.5 border-b border-line/50 px-4 py-2.5 text-sm last:border-b-0"
              >
                <input
                  type="checkbox"
                  checked={task.status === "done"}
                  disabled={readOnly || task.status === "dropped"}
                  onChange={() =>
                    patchTask(task.id, { status: task.status === "done" ? "todo" : "done" })
                  }
                  className="accent-current"
                />
                <span className={`min-w-0 flex-1 truncate ${isClosed ? "text-muted line-through" : ""}`}>
                  {task.title}
                </span>
                {task.projectId && task.projectTitle && (
                  <Link
                    href={`/projects/${task.projectId}`}
                    className="flex-none rounded-full border border-line bg-surface-2 px-2 text-[11px] text-muted hover:text-ink"
                  >
                    #{task.projectTitle}
                  </Link>
                )}
                {!readOnly && !task.projectId && !isClosed && (
                  <button
                    onClick={() => promote(task.id)}
                    className="flex-none rounded border border-line px-1.5 py-0.5 text-[11px] text-muted opacity-0 hover:text-ink group-hover:opacity-100"
                  >
                    프로젝트로 만들기
                  </button>
                )}
                {!readOnly && !isClosed && (
                  <button
                    onClick={() => patchTask(task.id, { status: "dropped" })}
                    className="flex-none px-1 text-[11px] text-muted opacity-0 hover:text-ink group-hover:opacity-100"
                    title="접기 (dropped — 취소선으로 잔존)"
                  >
                    ⌫
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {!readOnly && (
        <input
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && addTask()}
          placeholder="+ 올해 하고 싶은 일 (Enter)"
          className="rounded-md border border-dashed border-line bg-surface px-3 py-2 text-xs outline-none placeholder:text-muted focus:border-primary"
        />
      )}
    </div>
  );
}
