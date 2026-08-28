"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ProjectDocument } from "@/lib/projects/model";
import { DOC_TEMPLATES } from "@/lib/projects/templates";
import { formatGuessDate } from "@/lib/capture/format";
import { UndoToasts, useUndoQueue, type UndoEntry } from "@/components/undo-toast";

// 문서 탭 — 단순 목록 + 템플릿 4종, 에디터는 textarea 수준 (§5-4, 고도화하지 않음)
export function DocsTab({ projectId, docs }: { projectId: string; docs: ProjectDocument[] }) {
  const router = useRouter();
  const [openId, setOpenId] = useState<string | null>(null);
  const [draft, setDraft] = useState<{ title: string; content: string } | null>(null);
  const [saved, setSaved] = useState(false);
  const undoQueue = useUndoQueue<ProjectDocument>();

  const openDoc = docs.find((d) => d.id === openId) ?? null;

  const createDoc = async (template: string | null) => {
    const res = await fetch(`/api/projects/${projectId}/documents`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ template }),
    }).catch(() => null);
    if (!res?.ok) return;
    const { item } = (await res.json()) as { item: ProjectDocument };
    setOpenId(item.id);
    setDraft({ title: item.title, content: item.content ?? "" });
    router.refresh();
  };

  const saveDoc = async () => {
    if (!openDoc || !draft) return;
    const res = await fetch(`/api/documents/${openDoc.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: draft.title.trim() || openDoc.title, content: draft.content }),
    }).catch(() => null);
    if (res?.ok) {
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
      router.refresh();
    }
  };

  // 즉시 삭제 + 5초 되돌리기 (공통 규칙 §0.4)
  const deleteDoc = async () => {
    if (!openDoc) return;
    const res = await fetch(`/api/documents/${openDoc.id}`, { method: "DELETE" }).catch(() => null);
    if (!res?.ok) return;
    const { item } = (await res.json()) as { item: ProjectDocument };
    undoQueue.push({ key: item.id, label: item.title, payload: item });
    setOpenId(null);
    setDraft(null);
    router.refresh();
  };

  const undoDelete = async (entry: UndoEntry<ProjectDocument>) => {
    const doc = undoQueue.take(entry);
    await fetch(`/api/documents/${doc.id}/restore`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(doc),
    }).catch(() => null);
    router.refresh();
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted">+ 새 문서:</span>
        {Object.entries(DOC_TEMPLATES).map(([key, tpl]) => (
          <button
            key={key}
            onClick={() => createDoc(key)}
            className="rounded-md border border-line px-2.5 py-1 text-xs text-muted hover:text-ink"
          >
            {tpl.label}
          </button>
        ))}
        <button
          onClick={() => createDoc(null)}
          className="rounded-md border border-line px-2.5 py-1 text-xs text-muted hover:text-ink"
        >
          빈 문서
        </button>
      </div>

      {docs.length === 0 ? (
        <div className="rounded-xl border border-line bg-surface p-8 text-center text-sm text-muted">
          기능 명세 · 화면설계 · ERD · API 스펙 템플릿으로 시작해보세요
        </div>
      ) : (
        <ul className="overflow-hidden rounded-xl border border-line bg-surface">
          {docs.map((doc) => (
            <li key={doc.id}>
              <button
                onClick={() => {
                  setOpenId(doc.id === openId ? null : doc.id);
                  setDraft({ title: doc.title, content: doc.content ?? "" });
                }}
                className={`flex w-full items-center gap-3 border-b border-line/50 px-4 py-2.5 text-left text-xs last:border-b-0 hover:bg-surface-2 ${
                  doc.id === openId ? "bg-surface-2" : ""
                }`}
              >
                <span className="min-w-0 flex-1 truncate font-medium">▤ {doc.title}</span>
                <span className="flex-none text-[11px] text-muted">
                  {formatGuessDate(doc.updatedAt.slice(0, 10))} 수정
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {openDoc && draft && (
        <section className="flex flex-col gap-2 rounded-xl border border-line bg-surface p-4">
          <div className="flex items-center gap-2">
            <input
              value={draft.title}
              onChange={(e) => setDraft({ ...draft, title: e.target.value })}
              className="min-w-0 flex-1 rounded-md border border-line bg-transparent px-2.5 py-1.5 text-sm font-bold outline-none focus:border-primary"
            />
            {saved && <span className="flex-none text-[11px] text-muted">저장됨 ✓</span>}
            <button
              onClick={saveDoc}
              className="flex-none rounded-md border border-ink px-3 py-1.5 text-xs font-medium hover:bg-surface-2"
            >
              저장
            </button>
            <button
              onClick={deleteDoc}
              className="flex-none rounded-md border border-line px-2.5 py-1.5 text-xs text-muted hover:text-ink"
            >
              삭제
            </button>
          </div>
          <textarea
            value={draft.content}
            onChange={(e) => setDraft({ ...draft, content: e.target.value })}
            rows={18}
            className="resize-y rounded-md border border-line bg-surface px-3 py-2 font-mono text-[13px] leading-relaxed outline-none focus:border-primary"
          />
        </section>
      )}

      <UndoToasts entries={undoQueue.entries} onUndo={undoDelete} />
    </div>
  );
}
