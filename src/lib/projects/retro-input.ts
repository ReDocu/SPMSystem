import type { RetroFields } from "@/lib/projects/model";

const MAX_TEXT = 5000;
const KEYS = ["good", "bad", "learned", "neverAgain"] as const;

/** 회고 4문항 본문 검증 — 전이 게이트와 회고 탭 저장 공용. */
export function parseRetroFields(body: Record<string, unknown>): RetroFields {
  const fields: RetroFields = {};
  for (const key of KEYS) {
    if (body[key] === undefined) continue;
    fields[key] =
      typeof body[key] === "string" ? (body[key] as string).trim().slice(0, MAX_TEXT) || null : null;
  }
  return fields;
}

export function hasAnyRetroField(fields: RetroFields): boolean {
  return Object.values(fields).some((v) => v);
}
