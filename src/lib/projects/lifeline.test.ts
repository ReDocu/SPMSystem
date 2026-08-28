import { describe, expect, test } from "vitest";
import { buildLifeline } from "./lifeline";

describe("buildLifeline — 상태 구간 바 + 마커 (프로젝트 상세기획 §5.5)", () => {
  const events = [
    { toStatus: "idea", occurredAt: "2026-03-01" },
    { toStatus: "planning", occurredAt: "2026-03-10" },
    { toStatus: "active", occurredAt: "2026-04-02" },
    { toStatus: "live", occurredAt: "2026-08-20" },
  ];

  test("전이 이력을 체류 구간으로 바꾼다 (마지막 구간은 오늘까지)", () => {
    const line = buildLifeline(events, [], [], "2026-08-28");
    expect(line.segments.map((s) => s.status)).toEqual(["idea", "planning", "active", "live"]);
    expect(line.segments[0]).toMatchObject({ from: "2026-03-01", to: "2026-03-10" });
    expect(line.segments[3]).toMatchObject({ from: "2026-08-20", to: "2026-08-28" });
    expect(line.totalDays).toBe(180);
  });

  test("구간 비율은 일수 기반", () => {
    const line = buildLifeline(
      [
        { toStatus: "idea", occurredAt: "2026-08-01" },
        { toStatus: "active", occurredAt: "2026-08-21" },
      ],
      [], [],
      "2026-08-31",
    );
    // idea 20일 / active 10일 → 총 30일
    expect(line.segments[0].ratio).toBeCloseTo(2 / 3, 2);
    expect(line.segments[1].ratio).toBeCloseTo(1 / 3, 2);
  });

  test("마일스톤◆·배포▲ 마커를 타임라인 위치로 배치", () => {
    const line = buildLifeline(
      events,
      [{ title: "MVP", date: "2026-05-15" }],
      [{ title: "v0.1", date: "2026-06-01" }],
      "2026-08-28",
    );
    const ms = line.markers.find((m) => m.kind === "milestone");
    const dep = line.markers.find((m) => m.kind === "deploy");
    expect(ms?.title).toBe("MVP");
    expect(ms && ms.position > 0 && ms.position < 1).toBe(true);
    expect(dep && dep.position > (ms?.position ?? 1)).toBe(true);
  });

  test("범위 밖 마커는 제외", () => {
    const line = buildLifeline(events, [{ title: "먼 미래", date: "2027-01-01" }], [], "2026-08-28");
    expect(line.markers).toHaveLength(0);
  });

  test("이벤트가 없으면 빈 타임라인", () => {
    const line = buildLifeline([], [], [], "2026-08-28");
    expect(line.segments).toEqual([]);
    expect(line.totalDays).toBe(0);
  });
});
