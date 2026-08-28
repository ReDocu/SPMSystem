// 클라이언트에서도 쓰는 타입·상수 — pg를 끌고 오는 repo와 분리

export type ProjectStatus =
  | "idea"
  | "planning"
  | "active"
  | "live"
  | "paused"
  | "completed"
  | "dropped";

export type ProjectGroup = "진행중" | "대기중" | "완료" | "폐기";

export interface Project {
  id: string;
  title: string;
  status: ProjectStatus;
  description: string | null;
  purpose: string | null;
  targetUser: string | null;
  scopeIn: string | null;
  scopeOut: string | null;
  techStack: string[] | null;
  repoUrl: string | null;
  deployUrl: string | null;
  platformId: string | null;
  progress: number;
  color: string | null;
  createdAt: string;
}

export interface Milestone {
  id: string;
  projectId: string;
  title: string;
  dueDate: string | null;
  weight: number;
}

export interface ProjectDocument {
  id: string;
  projectId: string;
  title: string;
  content: string | null;
  templateType: string | null;
  updatedAt: string;
}

export interface KanbanTask {
  id: string;
  title: string;
  status: string;
  dueDate: string | null;
  plannedDate: string | null;
  milestoneId: string | null;
}

export const STATUS_LABELS: Record<ProjectStatus, string> = {
  idea: "idea",
  planning: "planning",
  active: "active",
  live: "live",
  paused: "paused",
  completed: "완료",
  dropped: "폐기",
};

// 관리 그룹 4개 (상세기획 §1.1)
export const STATUS_GROUPS: Record<ProjectGroup, ProjectStatus[]> = {
  진행중: ["active", "live"],
  대기중: ["idea", "planning", "paused"],
  완료: ["completed"],
  폐기: ["dropped"],
};

export function groupOf(status: ProjectStatus): ProjectGroup {
  for (const [group, statuses] of Object.entries(STATUS_GROUPS)) {
    if (statuses.includes(status)) return group as ProjectGroup;
  }
  return "대기중";
}

/**
 * 전이 규칙 (상세기획 §1): 정방향 게이트 + paused는 active에서만 +
 * 어디서든 dropped + 역전이(completed/dropped → active)
 */
export const TRANSITIONS: Record<ProjectStatus, ProjectStatus[]> = {
  idea: ["planning", "dropped"],
  planning: ["active", "dropped"],
  active: ["live", "paused", "completed", "dropped"],
  live: ["completed", "dropped"],
  paused: ["active", "dropped"],
  completed: ["active"],
  dropped: ["active"],
};

// 게이트 이름 (전이 → 게이트). G3 실질 동작·G4 회고는 v0.5/v0.6
export function gateOf(from: ProjectStatus, to: ProjectStatus): "G1" | "G2" | "G3" | null {
  if (from === "idea" && to === "planning") return "G1";
  if (from === "planning" && to === "active") return "G2";
  if (from === "active" && to === "live") return "G3";
  return null;
}

// 생애 타임라인 상태 구간 색 (§5.5 — 구간 색은 상태별 고정)
export const STATUS_COLORS: Record<string, string> = {
  idea: "#B0AFAF",
  planning: "#F08C00",
  active: "#1971C2",
  live: "#2F9E44",
  paused: "#9C36B5",
  completed: "#495057",
  dropped: "#E03131",
};

// 프로젝트 색상 자동 배정 팔레트 (G2 — 생성 순서대로 순환)
export const PROJECT_COLORS = [
  "#E8590C",
  "#1971C2",
  "#2F9E44",
  "#9C36B5",
  "#E03131",
  "#0C8599",
  "#F08C00",
  "#6741D9",
] as const;

/** 킥오프(G1) 채움도 — "3/4 채움" 표시용. */
export function kickoffFill(p: Project): { filled: number; total: number } {
  const fields = [p.purpose, p.targetUser, p.scopeIn, p.scopeOut];
  return { filled: fields.filter((f) => f && f.trim()).length, total: fields.length };
}
