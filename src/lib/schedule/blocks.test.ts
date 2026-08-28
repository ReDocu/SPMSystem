import { describe, expect, test } from "vitest";
import { formatDaySummary, mergeAdjacentLogs, summarizeDay } from "./blocks";

const log = (id: string, startMin: number, endMin: number, content: string) => ({
  id,
  startMin,
  endMin,
  content,
});

describe("mergeAdjacentLogs — 연속된 같은 활동은 하나의 블록 (상세기획 §4.3)", () => {
  test("이어진 동일 내용 로그를 한 블록으로 합친다", () => {
    const merged = mergeAdjacentLogs([
      log("a", 9 * 60, 10 * 60, "SPM 개발"),
      log("b", 10 * 60, 11 * 60, "SPM 개발"),
    ]);
    expect(merged).toHaveLength(1);
    expect(merged[0].startMin).toBe(9 * 60);
    expect(merged[0].endMin).toBe(11 * 60);
    expect(merged[0].logIds).toEqual(["a", "b"]);
  });

  test("내용이 다르면 합치지 않는다", () => {
    const merged = mergeAdjacentLogs([
      log("a", 9 * 60, 10 * 60, "SPM 개발"),
      log("b", 10 * 60, 11 * 60, "점심"),
    ]);
    expect(merged).toHaveLength(2);
  });

  test("시간이 떨어져 있으면 같은 내용이어도 합치지 않는다", () => {
    const merged = mergeAdjacentLogs([
      log("a", 9 * 60, 10 * 60, "SPM 개발"),
      log("b", 11 * 60, 12 * 60, "SPM 개발"),
    ]);
    expect(merged).toHaveLength(2);
  });

  test("정렬되지 않은 입력도 시작 시각 순으로 처리한다", () => {
    const merged = mergeAdjacentLogs([
      log("b", 10 * 60, 11 * 60, "SPM 개발"),
      log("a", 9 * 60, 10 * 60, "SPM 개발"),
    ]);
    expect(merged).toHaveLength(1);
    expect(merged[0].logIds).toEqual(["a", "b"]);
  });
});

describe("summarizeDay — 하루 요약 집계 (상세기획 §4.6)", () => {
  test("총 시간과 #태그별 시간을 집계한다", () => {
    const s = summarizeDay([
      log("a", 9 * 60, 14 * 60, "SPM 개발 #SPM"),
      log("b", 14 * 60, 16 * 60, "#블로그 초고"),
      log("c", 16 * 60, 18 * 60, "산책"),
    ]);
    expect(s.totalMin).toBe(9 * 60);
    expect(s.byTag).toEqual([
      { tag: "SPM", min: 5 * 60 },
      { tag: "블로그", min: 2 * 60 },
    ]);
    expect(s.etcMin).toBe(2 * 60);
  });

  test("기록이 없으면 0", () => {
    const s = summarizeDay([]);
    expect(s.totalMin).toBe(0);
    expect(s.byTag).toEqual([]);
  });
});

describe("formatDaySummary — '기록 9h · #SPM 5h · 기타 2h' 한 줄", () => {
  test("태그·기타 순으로 잇는다", () => {
    const line = formatDaySummary({
      totalMin: 9 * 60,
      byTag: [
        { tag: "SPM", min: 5 * 60 },
        { tag: "블로그", min: 2 * 60 },
      ],
      etcMin: 2 * 60,
    });
    expect(line).toBe("기록 9h · #SPM 5h · #블로그 2h · 기타 2h");
  });

  test("30분 단위는 소수 한 자리로", () => {
    const line = formatDaySummary({ totalMin: 90, byTag: [], etcMin: 90 });
    expect(line).toBe("기록 1.5h · 기타 1.5h");
  });

  test("기록이 없으면 안내 문구", () => {
    expect(formatDaySummary({ totalMin: 0, byTag: [], etcMin: 0 })).toBe(
      "기록 0h — 빈 칸을 눌러 기록해보세요",
    );
  });
});
