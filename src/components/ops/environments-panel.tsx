"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Environment, EnvironmentBackup, SecretMeta } from "@/lib/ops/model";
import { UndoToasts, useUndoQueue, type UndoEntry } from "@/components/undo-toast";

interface Option {
  id: string;
  name?: string;
  title?: string;
}

const EMPTY_FORM = {
  projectId: "",
  name: "",
  platformId: "",
  host: "",
  domain: "",
  sslExpiresAt: "",
  secretsText: "",
};

// 시크릿은 "키이름 @보관위치 용도" 한 줄 형식 — 값 입력 필드 자체가 없다 (§6)
function parseSecretsText(text: string): SecretMeta[] {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [key, ...rest] = line.split(/\s+/);
      const location = rest.find((w) => w.startsWith("@"))?.slice(1) ?? "";
      const purpose = rest.filter((w) => !w.startsWith("@")).join(" ");
      return { key, location, purpose };
    });
}

const secretsToText = (secrets: SecretMeta[]) =>
  secrets.map((s) => [s.key, s.location && `@${s.location}`, s.purpose].filter(Boolean).join(" ")).join("\n");

export function EnvironmentsPanel({
  environments,
  platforms,
  projects,
  initialProjectId,
}: {
  environments: Environment[];
  platforms: Option[];
  projects: Option[];
  initialProjectId?: string | null;
}) {
  const router = useRouter();
  const [form, setForm] = useState({
    ...EMPTY_FORM,
    projectId: initialProjectId && projects.some((p) => p.id === initialProjectId) ? initialProjectId : "",
  });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const undoQueue = useUndoQueue<EnvironmentBackup>();

  const byProject = new Map<string, Environment[]>();
  for (const env of environments) {
    byProject.set(env.projectId, [...(byProject.get(env.projectId) ?? []), env]);
  }

  const submit = async () => {
    if (!form.name.trim() || (!editingId && !form.projectId)) return;
    setError(null);
    const body = {
      projectId: form.projectId,
      name: form.name,
      platformId: form.platformId || null,
      host: form.host || null,
      domain: form.domain || null,
      sslExpiresAt: form.sslExpiresAt || null,
      secrets: parseSecretsText(form.secretsText),
    };
    const res = await fetch(editingId ? `/api/environments/${editingId}` : "/api/environments", {
      method: editingId ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).catch(() => null);
    if (!res?.ok) {
      const data = await res?.json().catch(() => null);
      setError(data?.error ?? "저장하지 못했습니다");
      return;
    }
    setForm(EMPTY_FORM);
    setEditingId(null);
    router.refresh();
  };

  const startEdit = (env: Environment) => {
    setEditingId(env.id);
    setForm({
      projectId: env.projectId,
      name: env.name,
      platformId: env.platformId ?? "",
      host: env.host ?? "",
      domain: env.domain ?? "",
      sslExpiresAt: env.sslExpiresAt ?? "",
      secretsText: secretsToText(env.secrets),
    });
  };

  const handleDelete = async (env: Environment) => {
    const res = await fetch(`/api/environments/${env.id}`, { method: "DELETE" }).catch(() => null);
    if (!res?.ok) {
      setError("삭제하지 못했습니다");
      return;
    }
    const backup = (await res.json()) as EnvironmentBackup;
    undoQueue.push({
      key: backup.environment.id,
      label: `${backup.environment.projectTitle} ${backup.environment.name}${
        backup.deployments.length > 0 ? ` (배포 ${backup.deployments.length}건 포함)` : ""
      }`,
      payload: backup,
    });
    router.refresh();
  };

  const handleUndo = async (entry: UndoEntry<EnvironmentBackup>) => {
    const backup = undoQueue.take(entry);
    await fetch(`/api/environments/${backup.environment.id}/restore`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(backup),
    }).catch(() => null);
    router.refresh();
  };

  const inputCls = "rounded-md border border-line bg-surface px-2.5 py-1.5 text-xs outline-none focus:border-primary";

  return (
    <div className="flex max-w-3xl flex-col gap-3">
      <div className="flex flex-col gap-2 rounded-xl border border-dashed border-line bg-surface p-3">
        <div className="flex flex-wrap items-center gap-2">
          <select value={form.projectId} onChange={(e) => setForm({ ...form, projectId: e.target.value })} disabled={Boolean(editingId)} className={inputCls}>
            <option value="">프로젝트 선택</option>
            {projects.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
          </select>
          <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="환경 이름 (prod / db …)" className={`${inputCls} w-36`} />
          <select value={form.platformId} onChange={(e) => setForm({ ...form, platformId: e.target.value })} className={inputCls}>
            <option value="">플랫폼 없음</option>
            {platforms.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <input value={form.host} onChange={(e) => setForm({ ...form, host: e.target.value })} placeholder="호스트/스펙" className={`${inputCls} w-32`} />
          <input value={form.domain} onChange={(e) => setForm({ ...form, domain: e.target.value })} placeholder="도메인" className={`${inputCls} w-36`} />
          <label className="flex items-center gap-1 text-[11px] text-muted">
            SSL 만료
            <input type="date" value={form.sslExpiresAt} onChange={(e) => setForm({ ...form, sslExpiresAt: e.target.value })} className={inputCls} />
          </label>
        </div>
        <textarea
          value={form.secretsText}
          onChange={(e) => setForm({ ...form, secretsText: e.target.value })}
          rows={2}
          placeholder={"시크릿 메타 (줄당 1개): 키이름 @보관위치 용도  — 값은 저장하지 않습니다\n예: SUPABASE_KEY @Vercel-env DB 접속"}
          className={`${inputCls} resize-y font-mono`}
        />
        <div className="flex items-center gap-2">
          {error && <span className="text-xs text-muted">{error}</span>}
          <span className="flex-1" />
          {editingId && (
            <button onClick={() => { setEditingId(null); setForm(EMPTY_FORM); }} className="rounded-md border border-line px-2.5 py-1.5 text-xs text-muted hover:text-ink">
              취소
            </button>
          )}
          <button onClick={submit} className="rounded-md border border-ink px-3 py-1.5 text-xs font-medium hover:bg-surface-2">
            {editingId ? "저장" : "+ 환경 추가"}
          </button>
        </div>
      </div>

      {environments.length === 0 && (
        <div className="rounded-xl border border-line bg-surface p-8 text-center text-sm text-muted">
          아직 환경이 없습니다 — live 프로젝트의 살림살이를 등록해보세요
        </div>
      )}
      {[...byProject.entries()].map(([projectId, envs]) => (
        <section key={projectId} className="overflow-hidden rounded-xl border border-line bg-surface">
          <h2 className="border-b border-line/50 px-4 py-2 text-[13px] font-bold">▾ {envs[0].projectTitle}</h2>
          {envs.map((env) => (
            <div key={env.id} className="group flex flex-col gap-1 border-b border-line/50 px-4 py-2.5 last:border-b-0">
              <div className="flex items-center gap-3 text-xs">
                <span className="w-20 flex-none font-medium">{env.name}</span>
                <span className="w-28 flex-none text-muted">{env.platformName ?? "—"}</span>
                <span className="min-w-0 flex-1 truncate text-muted">{env.domain ?? env.host ?? "—"}</span>
                {env.sslExpiresAt && <span className="flex-none text-muted">SSL {env.sslExpiresAt}</span>}
                <button onClick={() => startEdit(env)} className="flex-none rounded border border-line px-1.5 py-0.5 text-[11px] text-muted opacity-0 hover:text-ink group-hover:opacity-100">
                  수정
                </button>
                <button onClick={() => handleDelete(env)} className="flex-none rounded border border-line px-1.5 py-0.5 text-[11px] text-muted opacity-0 hover:text-ink group-hover:opacity-100">
                  삭제
                </button>
              </div>
              {env.secrets.length > 0 && (
                <p className="text-[11px] text-muted">
                  시크릿 메타:{" "}
                  {env.secrets.map((s) => `${s.key} → ${s.location || "?"}${s.purpose ? ` (${s.purpose})` : ""}`).join(" · ")}{" "}
                  <span className="opacity-60">(값 없음)</span>
                </p>
              )}
            </div>
          ))}
        </section>
      ))}

      <UndoToasts entries={undoQueue.entries} onUndo={handleUndo} />
    </div>
  );
}
