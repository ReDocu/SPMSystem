import { isUuid } from "@/lib/ids";
import type { ProjectPatch } from "@/lib/projects/repo";

const TEXT_KEYS = [
  "title",
  "description",
  "purpose",
  "targetUser",
  "scopeIn",
  "scopeOut",
  "repoUrl",
  "deployUrl",
] as const;

/** 요청 본문 → 프로젝트 patch (게이트 카드·개요 수정 공용 검증). */
export function parseProjectPatch(body: Record<string, unknown>): ProjectPatch {
  const patch: ProjectPatch = {};
  for (const key of TEXT_KEYS) {
    if (body[key] === undefined) continue;
    const value = typeof body[key] === "string" ? (body[key] as string).trim().slice(0, 4000) : "";
    if (key === "title") {
      if (value) patch.title = value;
    } else {
      patch[key] = value || null;
    }
  }
  if (body.platformId !== undefined) {
    patch.platformId = isUuid(body.platformId) ? (body.platformId as string) : null;
  }
  if (body.techStack !== undefined) {
    patch.techStack = Array.isArray(body.techStack)
      ? body.techStack
          .filter((s): s is string => typeof s === "string" && Boolean(s.trim()))
          .slice(0, 30)
      : null;
  }
  return patch;
}
