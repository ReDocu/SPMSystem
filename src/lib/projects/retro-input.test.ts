import { describe, expect, test } from "vitest";
import { hasAnyRetroField, parseRetroFields } from "./retro-input";

describe("parseRetroFields — 회고 4문항 검증", () => {
  test("있는 키만 담는다 (부분 갱신 — 기존 답변 보존의 전제)", () => {
    expect(parseRetroFields({ good: "잘함" })).toEqual({ good: "잘함" });
    expect(parseRetroFields({})).toEqual({});
  });

  test("빈 문자열·공백은 null로 (명시적 지우기)", () => {
    expect(parseRetroFields({ bad: "  " })).toEqual({ bad: null });
  });

  test("문자열이 아니면 null, 길이 캡 적용", () => {
    expect(parseRetroFields({ learned: 123 })).toEqual({ learned: null });
    const r = parseRetroFields({ neverAgain: "가".repeat(6000) });
    expect(r.neverAgain?.length).toBe(5000);
  });

  test("허용 목록 밖 키는 무시한다", () => {
    expect(parseRetroFields({ stats: { days: 1 }, projectId: "x", good: "ok" })).toEqual({
      good: "ok",
    });
  });
});

describe("hasAnyRetroField", () => {
  test("하나라도 값이 있으면 true, null·빈 객체는 false", () => {
    expect(hasAnyRetroField({ good: "x" })).toBe(true);
    expect(hasAnyRetroField({ good: null })).toBe(false);
    expect(hasAnyRetroField({})).toBe(false);
  });
});
