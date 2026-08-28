"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { gateOf, type Project, type ProjectStatus } from "@/lib/projects/model";

interface GateCardProps {
  project: Project;
  to: ProjectStatus | null; // null이면 전이 없이 필드만 수정 ([게이트 카드 다시 열기])
  reopenGate?: "G1" | "G2" | "G3"; // 다시 열기 시 어느 게이트의 필드인지 (기본 G1 킥오프)
  platforms?: { id: string; name: string }[]; // G3 플랫폼 선택 = 카탈로그 참조 (§3.1)
  onClose: () => void;
}

// 게이트 카드 — 유일하게 허용된 모달 (§5-6). 소프트 강제: 건너뛰어도 전이된다
export function GateCard({ project, to, reopenGate = "G1", platforms = [], onClose }: GateCardProps) {
  const router = useRouter();
  const gate = to ? gateOf(project.status, to) : reopenGate;
  const [fields, setFields] = useState({
    purpose: project.purpose ?? "",
    targetUser: project.targetUser ?? "",
    scopeIn: project.scopeIn ?? "",
    scopeOut: project.scopeOut ?? "",
    repoUrl: project.repoUrl ?? "",
    techStack: (project.techStack ?? []).join(", "),
    deployUrl: project.deployUrl ?? "",
    platformId: project.platformId ?? "",
    firstTasks: "",
    milestoneTitle: "",
    milestoneDue: "",
    good: "",
    bad: "",
    learned: "",
    neverAgain: "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (key: keyof typeof fields) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setFields({ ...fields, [key]: e.target.value });

  const buildPatch = () => {
    if (gate === "G1") {
      return {
        purpose: fields.purpose,
        targetUser: fields.targetUser,
        scopeIn: fields.scopeIn,
        scopeOut: fields.scopeOut,
      };
    }
    if (gate === "G2") {
      return {
        repoUrl: fields.repoUrl,
        techStack: fields.techStack.split(",").map((s) => s.trim()).filter(Boolean),
      };
    }
    return { deployUrl: fields.deployUrl, platformId: fields.platformId || null };
  };

  const submit = async (withFields: boolean) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    let ok = true;

    if (to) {
      // 채운 문항만 보낸다 — 빈 값까지 보내면 재종료 시 기존 회고 답변이 null로 덮인다
      const retroEntries =
        gate === "G4" && withFields
          ? Object.entries({
              good: fields.good,
              bad: fields.bad,
              learned: fields.learned,
              neverAgain: fields.neverAgain,
            }).filter(([, v]) => v.trim())
          : [];
      const res = await fetch(`/api/projects/${project.id}/transition`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to,
          patch: withFields && gate !== "G4" ? buildPatch() : {},
          ...(retroEntries.length > 0 && { retro: Object.fromEntries(retroEntries) }),
        }),
      }).catch(() => null);
      ok = Boolean(res?.ok);
      if (ok && res) {
        const data = (await res.json().catch(() => null)) as { retroSaved?: boolean } | null;
        if (data?.retroSaved === false) {
          // 전이는 됐지만 회고가 유실될 판 — 닫지 말고 알려서 회고 탭 재작성으로 유도
          setBusy(false);
          setError("전이는 완료됐지만 회고 저장에 실패했습니다 — 회고 탭에서 다시 작성해주세요");
          router.refresh();
          return;
        }
      }
      // G2: 첫 태스크·마일스톤 초안은 전이 후 이어서 생성
      if (ok && withFields && gate === "G2") {
        const tasks = fields.firstTasks.split("\n").map((s) => s.trim()).filter(Boolean).slice(0, 3);
        for (const title of tasks) {
          await fetch(`/api/projects/${project.id}/tasks`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ title }),
          }).catch(() => null);
        }
        if (fields.milestoneTitle.trim()) {
          await fetch(`/api/projects/${project.id}/milestones`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              title: fields.milestoneTitle.trim(),
              dueDate: fields.milestoneDue || null,
            }),
          }).catch(() => null);
        }
      }
    } else {
      const res = await fetch(`/api/projects/${project.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildPatch()),
      }).catch(() => null);
      ok = Boolean(res?.ok);
    }

    setBusy(false);
    if (!ok) {
      setError("저장하지 못했습니다 — 다시 시도해주세요");
      return;
    }
    onClose();
    router.refresh();
  };

  const input = (label: string, key: keyof typeof fields, placeholder = "") => (
    <label className="flex flex-col gap-1 text-xs">
      <span className="text-muted">{label}</span>
      <input
        value={fields[key]}
        onChange={set(key)}
        placeholder={placeholder}
        className="rounded-md border border-line bg-surface px-2.5 py-1.5 outline-none focus:border-primary"
      />
    </label>
  );

  const titles: Record<string, string> = {
    G1: "킥오프 — 왜, 누구를 위해, 무엇을",
    G2: "개발 시작 — 저장소·스택·첫 태스크",
    G3: "플랫폼 선정 — 배포 정보",
    G4: "회고 — 다음 프로젝트를 위한 기록",
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={onClose}>
      <div
        className="flex w-full max-w-md flex-col gap-3 rounded-xl border border-line bg-surface p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-sm font-bold">
          {to ? `${to}로 전이 — ${titles[gate ?? "G1"]}` : `게이트 카드 — ${titles[gate ?? "G1"]}`}
        </h2>

        {gate === "G1" && (
          <>
            {input("목적 (왜 만드나)", "purpose")}
            {input("타겟 (누구를 위해)", "targetUser")}
            {input("만들 것", "scopeIn")}
            {input("안 만들 것", "scopeOut")}
          </>
        )}
        {gate === "G2" && (
          <>
            {input("저장소 URL", "repoUrl", "https://github.com/…")}
            {input("기술스택 (쉼표 구분)", "techStack", "Next.js, Postgres")}
            <label className="flex flex-col gap-1 text-xs">
              <span className="text-muted">첫 태스크 (줄당 1개, 최대 3)</span>
              <textarea
                value={fields.firstTasks}
                onChange={set("firstTasks")}
                rows={3}
                className="rounded-md border border-line bg-surface px-2.5 py-1.5 outline-none focus:border-primary"
              />
            </label>
            <div className="flex gap-2">
              <div className="flex-1">{input("마일스톤 초안", "milestoneTitle", "MVP")}</div>
              <label className="flex w-32 flex-none flex-col gap-1 text-xs">
                <span className="text-muted">마감</span>
                <input
                  type="date"
                  value={fields.milestoneDue}
                  onChange={set("milestoneDue")}
                  className="rounded-md border border-line bg-surface px-2 py-1.5 outline-none focus:border-primary"
                />
              </label>
            </div>
            <p className="text-[11px] text-muted">
              색상 자동 배정: <span style={{ color: project.color ?? undefined }}>●</span>{" "}
              {project.color}
            </p>
          </>
        )}
        {gate === "G3" && (
          <>
            <label className="flex flex-col gap-1 text-xs">
              <span className="text-muted">배포 플랫폼 (카탈로그)</span>
              <select
                value={fields.platformId}
                onChange={(e) => setFields({ ...fields, platformId: e.target.value })}
                className="rounded-md border border-line bg-surface px-2.5 py-1.5 outline-none focus:border-primary"
              >
                <option value="">선택 안 함</option>
                {platforms.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </label>
            {input("배포 URL", "deployUrl", "https://…")}
            <p className="text-[11px] text-muted">
              전이 후 운영 › 환경에서 prod 환경을 등록하세요 — 운영 대시보드의 살림살이가 됩니다
            </p>
          </>
        )}

        {gate === "G4" && (
          <>
            {input("1. 잘한 것", "good")}
            {input("2. 아쉬운 것", "bad")}
            {input("3. 배운 것", "learned")}
            {input("4. 다음에 안 할 것 ★", "neverAgain")}
            <p className="text-[11px] text-muted">
              자동 수치(기간·투입·태스크·배포)는 저장 시점 스냅샷으로 함께 기록됩니다
            </p>
          </>
        )}

        {error && <p className="text-[11px] text-muted">{error}</p>}

        <div className="mt-1 flex items-center justify-end gap-2">
          {to && (
            <button
              onClick={() => submit(false)}
              disabled={busy}
              className="rounded-md border border-line px-3 py-1.5 text-xs text-muted hover:text-ink"
            >
              나중에 채우기
            </button>
          )}
          <button
            onClick={() => submit(true)}
            disabled={busy}
            className="rounded-md border border-ink px-3 py-1.5 text-xs font-medium hover:bg-surface-2"
          >
            {to ? "채우고 전이 →" : "저장"}
          </button>
        </div>
      </div>
    </div>
  );
}
