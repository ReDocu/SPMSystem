import { isUuid } from "@/lib/ids";
import { isDateKey } from "@/lib/schedule/validate";
import type { EnvironmentInput } from "@/lib/ops/repo";
import { CURRENCIES, type SecretMeta } from "@/lib/ops/model";

/** 가격 체크 공용 필드 검증 (등록·재확인 겸용). */
export function parseCostFields(body: Record<string, unknown>):
  | { amount: number; currency: string; cycle: string; nextBillingAt: string | null }
  | { error: string } {
  const amount =
    typeof body.amount === "number" && Number.isFinite(body.amount) && body.amount >= 0
      ? body.amount
      : null;
  if (amount === null) return { error: "금액이 올바르지 않습니다" };
  if (!CURRENCIES.includes(body.currency as (typeof CURRENCIES)[number])) {
    return { error: "통화가 올바르지 않습니다" };
  }
  if (!["monthly", "yearly", "once"].includes(body.cycle as string)) {
    return { error: "주기가 올바르지 않습니다" };
  }
  if (body.nextBillingAt != null && body.nextBillingAt !== "" && !isDateKey(body.nextBillingAt)) {
    return { error: "갱신일이 올바르지 않습니다" };
  }
  return {
    amount,
    currency: body.currency as string,
    cycle: body.cycle as string,
    nextBillingAt: isDateKey(body.nextBillingAt) ? (body.nextBillingAt as string) : null,
  };
}

const MAX_TEXT = 300;

const text = (v: unknown, max = MAX_TEXT): string | null =>
  typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null;

function parseSecrets(value: unknown): SecretMeta[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((s): s is Record<string, unknown> => Boolean(s) && typeof s === "object")
    .map((s) => ({
      key: text(s.key, 100) ?? "",
      location: text(s.location, 100) ?? "",
      purpose: text(s.purpose, 200) ?? "",
    }))
    .filter((s) => s.key)
    .slice(0, 50);
}

/** 환경 생성·수정 본문 공용 검증 — 시크릿은 메타만, 값 필드는 받지 않는다 (§6). */
export function parseEnvironmentInput(
  body: Record<string, unknown>,
  requireProject: boolean,
): { input: EnvironmentInput } | { error: string } {
  if (requireProject && !isUuid(body.projectId)) return { error: "프로젝트가 올바르지 않습니다" };
  const name = text(body.name, 50);
  if (!name) return { error: "환경 이름이 비어 있습니다" };
  if (body.platformId != null && body.platformId !== "" && !isUuid(body.platformId)) {
    return { error: "플랫폼이 올바르지 않습니다" };
  }
  if (body.sslExpiresAt != null && body.sslExpiresAt !== "" && !isDateKey(body.sslExpiresAt)) {
    return { error: "SSL 만료일이 올바르지 않습니다" };
  }
  return {
    input: {
      projectId: (body.projectId as string) ?? "",
      name,
      platformId: isUuid(body.platformId) ? (body.platformId as string) : null,
      host: text(body.host, 200),
      domain: text(body.domain, 200),
      sslExpiresAt: isDateKey(body.sslExpiresAt) ? (body.sslExpiresAt as string) : null,
      secrets: parseSecrets(body.secrets),
    },
  };
}
