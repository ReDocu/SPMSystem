import { describe, expect, test } from "vitest";
import { parseCostFields, parseEnvironmentInput } from "./input";

const UUID = "11111111-2222-4333-8444-555555555555";

describe("parseCostFields — 가격 체크 공용 검증", () => {
  test("정상 입력", () => {
    const r = parseCostFields({ amount: 20, currency: "USD", cycle: "monthly", nextBillingAt: "2026-09-01" });
    expect(r).toEqual({ amount: 20, currency: "USD", cycle: "monthly", nextBillingAt: "2026-09-01" });
  });

  test("무료 0원은 유효하다 (인벤토리 등록)", () => {
    const r = parseCostFields({ amount: 0, currency: "KRW", cycle: "monthly" });
    expect("error" in r).toBe(false);
  });

  test("음수·NaN·문자열 금액 거부", () => {
    expect("error" in parseCostFields({ amount: -1, currency: "USD", cycle: "monthly" })).toBe(true);
    expect("error" in parseCostFields({ amount: NaN, currency: "USD", cycle: "monthly" })).toBe(true);
    expect("error" in parseCostFields({ amount: "20", currency: "USD", cycle: "monthly" })).toBe(true);
  });

  test("허용 목록 밖 통화·주기 거부", () => {
    expect("error" in parseCostFields({ amount: 1, currency: "BTC", cycle: "monthly" })).toBe(true);
    expect("error" in parseCostFields({ amount: 1, currency: "USD", cycle: "weekly" })).toBe(true);
  });

  test("잘못된 갱신일 거부, 빈 값은 null", () => {
    expect("error" in parseCostFields({ amount: 1, currency: "USD", cycle: "monthly", nextBillingAt: "2026-13-99" })).toBe(true);
    const r = parseCostFields({ amount: 1, currency: "USD", cycle: "monthly", nextBillingAt: "" });
    expect("error" in r ? null : r.nextBillingAt).toBeNull();
  });
});

describe("parseEnvironmentInput — 시크릿은 메타만 (§6)", () => {
  const base = { projectId: UUID, name: "prod" };

  test("정상 입력 + 시크릿 메타", () => {
    const r = parseEnvironmentInput(
      { ...base, secrets: [{ key: "DB_URL", location: "Vercel env", purpose: "DB" }] },
      true,
    );
    if ("error" in r) throw new Error(r.error);
    expect(r.input.secrets).toEqual([{ key: "DB_URL", location: "Vercel env", purpose: "DB" }]);
  });

  test("키 없는 시크릿 행은 버린다", () => {
    const r = parseEnvironmentInput({ ...base, secrets: [{ location: "x" }, { key: "K" }] }, true);
    if ("error" in r) throw new Error(r.error);
    expect(r.input.secrets).toEqual([{ key: "K", location: "", purpose: "" }]);
  });

  test("value 같은 임의 필드는 통과시키지 않는다 (값 미저장 보장)", () => {
    const r = parseEnvironmentInput(
      { ...base, secrets: [{ key: "K", value: "실제-시크릿-값", location: "x" }] },
      true,
    );
    if ("error" in r) throw new Error(r.error);
    expect(JSON.stringify(r.input.secrets)).not.toContain("실제-시크릿-값");
  });

  test("프로젝트 필수 모드에서 잘못된 id 거부", () => {
    expect("error" in parseEnvironmentInput({ name: "prod", projectId: "abc" }, true)).toBe(true);
    expect("error" in parseEnvironmentInput({ name: "prod" }, false)).toBe(false);
  });

  test("이름 없으면 거부, SSL 만료일 형식 검증", () => {
    expect("error" in parseEnvironmentInput({ projectId: UUID, name: " " }, true)).toBe(true);
    expect("error" in parseEnvironmentInput({ ...base, sslExpiresAt: "2026-02-30" }, true)).toBe(true);
  });
});
