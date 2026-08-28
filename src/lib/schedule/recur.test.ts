import { describe, expect, test } from "vitest";
import { expandOccurrences, type SeriesLike } from "./recur";

const series = (over: Partial<SeriesLike>): SeriesLike => ({
  startAt: new Date(2026, 7, 28, 15, 0), // 2026-08-28 (금) 15:00
  endAt: new Date(2026, 7, 28, 16, 0),
  rrule: null,
  exdates: [],
  ...over,
});

const range = (from: string, to: string) => {
  const [fy, fm, fd] = from.split("-").map(Number);
  const [ty, tm, td] = to.split("-").map(Number);
  return [new Date(fy, fm - 1, fd), new Date(ty, tm - 1, td)] as const;
};

const dates = (s: SeriesLike, from: string, to: string) =>
  expandOccurrences(s, ...range(from, to)).map((o) => o.date);

describe("expandOccurrences — 단발·범위", () => {
  test("단발 일정은 그 날짜 하나", () => {
    expect(dates(series({}), "2026-08-01", "2026-08-31")).toEqual(["2026-08-28"]);
  });

  test("범위 밖 단발은 제외", () => {
    expect(dates(series({}), "2026-09-01", "2026-09-30")).toEqual([]);
  });

  test("여러 날 일정(출장)은 날짜별 회차 + span 정보", () => {
    const s = series({
      startAt: new Date(2026, 7, 30, 9, 0),
      endAt: new Date(2026, 8, 1, 18, 0), // 8/30 ~ 9/1
    });
    const occ = expandOccurrences(s, ...range("2026-08-01", "2026-08-31"));
    expect(occ.map((o) => o.date)).toEqual(["2026-08-30", "2026-08-31"]);
    expect(occ[0].spanDays).toBe(3);
    expect(occ[0].dayIndex).toBe(0);
    expect(occ[1].dayIndex).toBe(1);
  });
});

describe("expandOccurrences — 반복", () => {
  test("WEEKLY는 같은 요일마다 (수업)", () => {
    expect(dates(series({ rrule: "FREQ=WEEKLY" }), "2026-09-01", "2026-09-30")).toEqual([
      "2026-09-04",
      "2026-09-11",
      "2026-09-18",
      "2026-09-25",
    ]);
  });

  test("시작일 이전 범위에는 회차가 없다", () => {
    expect(dates(series({ rrule: "FREQ=WEEKLY" }), "2026-07-01", "2026-07-31")).toEqual([]);
  });

  test("YEARLY는 매년 같은 월일 (기념일)", () => {
    const s = series({
      startAt: new Date(2026, 1, 14, 0, 0),
      endAt: new Date(2026, 1, 14, 23, 59),
      rrule: "FREQ=YEARLY",
    });
    expect(dates(s, "2027-02-01", "2027-02-28")).toEqual(["2027-02-14"]);
    expect(dates(s, "2027-03-01", "2027-03-31")).toEqual([]);
  });

  test("MONTHLY는 매월 같은 일", () => {
    expect(dates(series({ rrule: "FREQ=MONTHLY" }), "2026-10-01", "2026-10-31")).toEqual([
      "2026-10-28",
    ]);
  });

  test("DAILY", () => {
    expect(dates(series({ rrule: "FREQ=DAILY" }), "2026-08-28", "2026-08-30")).toEqual([
      "2026-08-28",
      "2026-08-29",
      "2026-08-30",
    ]);
  });

  test("EXDATE 회차는 건너뛴다 (휴강)", () => {
    expect(
      dates(
        series({ rrule: "FREQ=WEEKLY", exdates: ["2026-09-11"] }),
        "2026-09-01",
        "2026-09-30",
      ),
    ).toEqual(["2026-09-04", "2026-09-18", "2026-09-25"]);
  });

  test("31일 시작 MONTHLY는 없는 달을 건너뛴다", () => {
    const s = series({
      startAt: new Date(2026, 0, 31, 10, 0),
      endAt: new Date(2026, 0, 31, 11, 0),
      rrule: "FREQ=MONTHLY",
    });
    expect(dates(s, "2026-02-01", "2026-02-28")).toEqual([]);
    expect(dates(s, "2026-03-01", "2026-03-31")).toEqual(["2026-03-31"]);
  });
});
