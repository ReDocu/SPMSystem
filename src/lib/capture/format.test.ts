import { describe, expect, test } from "vitest";
import { formatGuessDate, formatTimeRange, guessBadges, typeLabel } from "./format";

describe("typeLabel — 추정 유형 한글 라벨", () => {
  test.each([
    ["resource", "자료"],
    ["task", "할 일"],
    ["project_task", "프로젝트 태스크"],
    ["snippet", "스니펫"],
    ["timelog", "타임로그"],
    ["event", "일정"],
    ["idea", "아이디어"],
  ] as const)("%s → %s", (type, label) => {
    expect(typeLabel(type)).toBe(label);
  });
});

describe("formatGuessDate — 파싱 날짜를 배지용 짧은 표기로", () => {
  test("YYYY-MM-DD를 M/D (요일)로 바꾼다", () => {
    expect(formatGuessDate("2026-08-28")).toBe("8/28 (금)");
  });

  test("한 자리 월·일은 0 없이 표기한다", () => {
    expect(formatGuessDate("2026-01-05")).toBe("1/5 (월)");
  });
});

describe("formatTimeRange — 분 단위 범위를 HH:MM–HH:MM으로", () => {
  test("정시 범위", () => {
    expect(formatTimeRange({ startMin: 14 * 60, endMin: 16 * 60 })).toBe("14:00–16:00");
  });

  test("분 단위는 0을 채운다", () => {
    expect(formatTimeRange({ startMin: 9 * 60 + 5, endMin: 10 * 60 + 30 })).toBe("09:05–10:30");
  });
});

describe("guessBadges — 인박스 카드 인라인 배지 (화면명세서 §3 ①)", () => {
  test("할 일 + 날짜: 유형과 날짜 배지", () => {
    expect(guessBadges({ type: "task", title: "로그인 API", date: "2026-08-28" })).toEqual([
      "할 일",
      "8/28 (금)",
    ]);
  });

  test("일정: 유형·날짜·시간 배지 순서", () => {
    expect(
      guessBadges({
        type: "event",
        title: "회의",
        date: "2026-08-28",
        timeRange: { startMin: 14 * 60, endMin: 16 * 60 },
      }),
    ).toEqual(["일정", "8/28 (금)", "14:00–16:00"]);
  });

  test("프로젝트 태스크: 프로젝트명을 # 배지로 앞세운다", () => {
    expect(guessBadges({ type: "project_task", title: "결제 모듈", project: "SPM" })).toEqual([
      "#SPM 태스크",
      // 날짜·시간 없음
    ]);
  });

  test("아이디어: 유형 배지만", () => {
    expect(guessBadges({ type: "idea", title: "뭐든" })).toEqual(["아이디어"]);
  });
});
