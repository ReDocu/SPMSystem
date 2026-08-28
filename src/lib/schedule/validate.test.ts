import { describe, expect, test } from "vitest";
import { isCondition, isDateKey, isMinuteRange } from "./validate";

describe("isDateKey", () => {
  test("정상 날짜는 통과한다", () => {
    expect(isDateKey("2026-08-28")).toBe(true);
    expect(isDateKey("2026-02-28")).toBe(true);
  });

  test("존재하지 않는 날짜는 거부한다 (V8 롤오버 방지)", () => {
    expect(isDateKey("2026-02-30")).toBe(false);
    expect(isDateKey("2026-13-05")).toBe(false);
    expect(isDateKey("2026-04-31")).toBe(false);
  });

  test("형식이 다르면 거부한다", () => {
    expect(isDateKey("2026-8-5")).toBe(false);
    expect(isDateKey("20260828")).toBe(false);
    expect(isDateKey(20260828)).toBe(false);
    expect(isDateKey(null)).toBe(false);
  });
});

describe("isMinuteRange", () => {
  test("0~1440 내 정수 오름차순만 통과", () => {
    expect(isMinuteRange(540, 600)).toBe(true);
    expect(isMinuteRange(0, 1440)).toBe(true);
    expect(isMinuteRange(600, 540)).toBe(false);
    expect(isMinuteRange(540, 540)).toBe(false);
    expect(isMinuteRange(-10, 60)).toBe(false);
    expect(isMinuteRange(0, 1441)).toBe(false);
    expect(isMinuteRange(0.5, 60)).toBe(false);
  });
});

describe("isCondition", () => {
  test("1~4 정수만 통과", () => {
    expect(isCondition(1)).toBe(true);
    expect(isCondition(4)).toBe(true);
    expect(isCondition(0)).toBe(false);
    expect(isCondition(5)).toBe(false);
    expect(isCondition(2.5)).toBe(false);
  });
});
