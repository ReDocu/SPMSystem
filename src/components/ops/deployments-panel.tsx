"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Deployment } from "@/lib/ops/model";

// 배포 이력 — 수동 기록 + 체크리스트 스냅샷 (§7). Webhook 반자동은 v0.6
export function DeploymentsPanel({
  deployments,
  environments,
  defaultChecklist,
}: {
  deployments: Deployment[];
  environments: { id: string; label: string }[];
  defaultChecklist: string[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ environmentId: "", version: "", changelog: "" });
  const [checked, setChecked] = useState<Set<number>>(new Set());
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!form.environmentId || !form.version.trim()) return;
    setError(null);
    const res = await fetch("/api/deployments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        checklist: defaultChecklist.map((item, i) => ({ item, checked: checked.has(i) })),
      }),
    }).catch(() => null);
    if (!res?.ok) {
      setError("저장하지 못했습니다");
      return;
    }
    setForm({ environmentId: "", version: "", changelog: "" });
    setChecked(new Set());
    setOpen(false);
    router.refresh();
  };

  const toggleRollback = async (d: Deployment) => {
    await fetch(`/api/deployments/${d.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rolledBack: !d.rolledBack }),
    }).catch(() => null);
    router.refresh();
  };

  const inputCls = "rounded-md border border-line bg-surface px-2.5 py-1.5 text-xs outline-none focus:border-primary";
  const checkSummary = (d: Deployment) => {
    if (!d.checklistSnapshot) return null;
    const done = d.checklistSnapshot.filter((c) => c.checked).length;
    const total = d.checklistSnapshot.length;
    return `체크 ${done}/${total}${done === total ? " ✓" : ""}`;
  };

  return (
    <div className="flex max-w-3xl flex-col gap-3">
      <button
        onClick={() => setOpen(!open)}
        className="self-start rounded-md border border-ink px-3 py-1.5 text-xs font-medium hover:bg-surface-2"
      >
        + 배포 기록
      </button>

      {open && (
        <div className="flex flex-col gap-2 rounded-xl border border-dashed border-line bg-surface p-3">
          <div className="flex flex-wrap items-center gap-2">
            <select value={form.environmentId} onChange={(e) => setForm({ ...form, environmentId: e.target.value })} className={inputCls}>
              <option value="">프로젝트/환경</option>
              {environments.map((e) => <option key={e.id} value={e.id}>{e.label}</option>)}
            </select>
            <input value={form.version} onChange={(e) => setForm({ ...form, version: e.target.value })} placeholder="버전 (v0.2)" className={`${inputCls} w-28`} />
            <input value={form.changelog} onChange={(e) => setForm({ ...form, changelog: e.target.value })} placeholder="변경사항" className={`${inputCls} min-w-0 flex-1`} />
          </div>
          {defaultChecklist.length > 0 && (
            <div className="flex flex-wrap gap-3 text-xs">
              {defaultChecklist.map((item, i) => (
                <label key={item} className="flex items-center gap-1">
                  <input
                    type="checkbox"
                    checked={checked.has(i)}
                    onChange={() =>
                      setChecked((prev) => {
                        const next = new Set(prev);
                        if (next.has(i)) next.delete(i);
                        else next.add(i);
                        return next;
                      })
                    }
                  />
                  {item}
                </label>
              ))}
            </div>
          )}
          <div className="flex items-center gap-2">
            {error && <span className="text-xs text-muted">{error}</span>}
            <span className="flex-1" />
            <button onClick={submit} className="rounded-md border border-ink px-3 py-1.5 text-xs font-medium hover:bg-surface-2">
              기록
            </button>
          </div>
        </div>
      )}

      {deployments.length === 0 ? (
        <div className="rounded-xl border border-line bg-surface p-8 text-center text-sm text-muted">
          첫 배포를 기록해보세요
        </div>
      ) : (
        <ul className="overflow-hidden rounded-xl border border-line bg-surface">
          {deployments.map((d) => (
            <li key={d.id} className="group flex flex-col gap-1 border-b border-line/50 px-4 py-2.5 last:border-b-0">
              <div className="flex items-center gap-3 text-xs">
                <span className={`w-16 flex-none font-mono font-medium ${d.rolledBack ? "text-muted line-through" : ""}`}>{d.version}</span>
                <span className="w-32 flex-none truncate text-muted">{d.projectTitle}/{d.envName}</span>
                <span className="w-32 flex-none text-muted">{d.deployedAt}</span>
                {checkSummary(d) && <span className="flex-none text-muted">{checkSummary(d)}</span>}
                {d.rolledBack && <span className="flex-none text-amber-500">롤백 ↩</span>}
                <span className="min-w-0 flex-1 truncate text-muted">{d.changelog}</span>
                <button
                  onClick={() => toggleRollback(d)}
                  className="flex-none rounded border border-line px-1.5 py-0.5 text-[11px] text-muted opacity-0 hover:text-ink group-hover:opacity-100"
                >
                  {d.rolledBack ? "롤백 해제" : "롤백 표시"}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
