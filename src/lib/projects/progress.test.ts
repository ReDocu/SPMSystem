import { describe, expect, test } from "vitest";
import { computeProgress } from "./progress";

const task = (status: string, milestoneId: string | null = null) => ({ status, milestoneId });

describe("computeProgress — 마일스톤 가중 평균 (상세기획 §4)", () => {
  test("마일스톤별 완료율 × 가중치의 가중 평균", () => {
    // MS A(가중 2): 2/2 완료 = 100% · MS B(가중 1): 0/1 = 0% → (200+0)/3 ≈ 67
    const progress = computeProgress(
      [
        { id: "a", weight: 2 },
        { id: "b", weight: 1 },
      ],
      [task("done", "a"), task("done", "a"), task("todo", "b")],
    );
    expect(progress).toBe(67);
  });

  test("dropped 태스크는 분모에서 제외한다", () => {
    const progress = computeProgress(
      [{ id: "a", weight: 1 }],
      [task("done", "a"), task("dropped", "a")],
    );
    expect(progress).toBe(100);
  });

  test("마일스톤이 없으면 태스크 개수 방식으로 폴백", () => {
    expect(computeProgress([], [task("done"), task("todo"), task("todo"), task("doing")])).toBe(25);
  });

  test("태스크 없는 마일스톤은 0%로 집계한다", () => {
    const progress = computeProgress(
      [
        { id: "a", weight: 1 },
        { id: "b", weight: 1 },
      ],
      [task("done", "a")],
    );
    expect(progress).toBe(50);
  });

  test("마일스톤 미배정 태스크는 마일스톤 방식에서 무시된다", () => {
    const progress = computeProgress([{ id: "a", weight: 1 }], [task("done", "a"), task("todo", null)]);
    expect(progress).toBe(100);
  });

  test("태스크가 전혀 없으면 0", () => {
    expect(computeProgress([], [])).toBe(0);
    expect(computeProgress([{ id: "a", weight: 3 }], [])).toBe(0);
  });

  test("전부 dropped여도 0으로 나누지 않는다", () => {
    expect(computeProgress([], [task("dropped")])).toBe(0);
  });
});
