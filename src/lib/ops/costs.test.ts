import { describe, expect, test } from "vitest";
import { formatCostSummary, isPriceStale, summarizeCosts } from "./costs";

const cost = (amount: number, currency: string, cycle: string) => ({ amount, currency, cycle });

describe("summarizeCosts — 통화별 병기, 월·연 분리 (O3·ISSUE-09)", () => {
  test("월 주기만 월 합계, 연 주기는 별도 — ÷12 환산하지 않는다", () => {
    const s = summarizeCosts([
      cost(20, "USD", "monthly"),
      cost(5, "USD", "monthly"),
      cost(3300, "KRW", "monthly"),
      cost(99, "USD", "yearly"),
      cost(22000, "KRW", "yearly"),
    ]);
    expect(s.monthly).toEqual([
      { currency: "USD", amount: 25 },
      { currency: "KRW", amount: 3300 },
    ]);
    expect(s.yearly).toEqual([
      { currency: "USD", amount: 99 },
      { currency: "KRW", amount: 22000 },
    ]);
  });

  test("일회성(once)은 합계에서 제외한다", () => {
    const s = summarizeCosts([cost(100, "USD", "once"), cost(10, "USD", "monthly")]);
    expect(s.monthly).toEqual([{ currency: "USD", amount: 10 }]);
    expect(s.yearly).toEqual([]);
  });

  test("무료(0원)는 합계에 영향 없다", () => {
    const s = summarizeCosts([cost(0, "USD", "monthly")]);
    expect(s.monthly).toEqual([{ currency: "USD", amount: 0 }]);
  });
});

describe("formatCostSummary — '월 $25 + ₩3,300 · 연 $99'", () => {
  test("통화 기호와 천 단위 구분", () => {
    const line = formatCostSummary({
      monthly: [
        { currency: "USD", amount: 25 },
        { currency: "KRW", amount: 3300 },
      ],
      yearly: [{ currency: "USD", amount: 99 }],
    });
    expect(line).toBe("월 $25 + ₩3,300 · 연 $99");
  });

  test("비어 있으면 안내", () => {
    expect(formatCostSummary({ monthly: [], yearly: [] })).toBe("등록된 비용 없음");
  });
});

describe("isPriceStale — 확인 후 90일 경과 시 흐림 (O4)", () => {
  const today = new Date(2026, 7, 28);
  test("90일 이내는 신선", () => {
    expect(isPriceStale("2026-06-01", today)).toBe(false);
  });
  test("90일 초과는 흐림", () => {
    expect(isPriceStale("2026-03-01", today)).toBe(true);
  });
  test("확인 이력이 없으면 흐림", () => {
    expect(isPriceStale(null, today)).toBe(true);
  });
});
