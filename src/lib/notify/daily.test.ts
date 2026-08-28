import { describe, expect, test } from "vitest";
import { buildDailySummary, type DailySummaryData } from "./daily";

const base: DailySummaryData = {
  dateLabel: "2026-08-26 (수)",
  events: [],
  anniversaries: [],
  dueTasks: [],
  expiring: [],
  inboxCount: 0,
  weekCollected: 0,
  weekly: null,
};

describe("buildDailySummary — 일일 요약 Discord 메시지 (기획서 §9.1)", () => {
  test("전체 섹션 조립", () => {
    const msg = buildDailySummary({
      dateLabel: "2026-08-26 (수)",
      events: [{ time: "15:00", title: "병원" }, { time: "19:00", title: "학원 수업" }],
      anniversaries: [{ title: "결혼기념일", dday: 3 }],
      dueTasks: ["로그인 API 구현", "병원 예약"],
      expiring: [{ label: "spm.example.com SSL 만료", dday: 12 }],
      inboxCount: 7,
      weekCollected: 12,
      weekly: null,
    });
    expect(msg).toContain("📋 2026-08-26 (수)");
    expect(msg).toContain("◷ 오늘 일정");
    expect(msg).toContain(" · 15:00 병원");
    expect(msg).toContain("🎂 결혼기념일 D-3");
    expect(msg).toContain("오늘 마감 2건");
    expect(msg).toContain("⚠️ 확인 필요");
    expect(msg).toContain(" · spm.example.com SSL 만료 D-12");
    expect(msg).toContain("📥 인박스 7건 미처리");
    expect(msg).toContain("📚 이번 주 수집 12건");
  });

  test("비어 있는 섹션은 통째로 생략한다 (조용함 원칙)", () => {
    const msg = buildDailySummary(base);
    expect(msg).toContain("📋 2026-08-26 (수)");
    expect(msg).not.toContain("오늘 일정");
    expect(msg).not.toContain("확인 필요");
    expect(msg).not.toContain("인박스");
    expect(msg).not.toContain("마감");
  });

  test("주간 요약은 월요일에만 3줄 추가 (IMP-02)", () => {
    const msg = buildDailySummary({
      ...base,
      weekly: {
        totalMin: 22 * 60,
        byProject: [
          { title: "SPM", min: 15 * 60 },
          { title: "블로그", min: 7 * 60 },
        ],
      },
    });
    expect(msg).toContain("📈 지난주 기록 22h");
    expect(msg).toContain(" · SPM 15h");
    expect(msg).toContain(" · 블로그 7h");
  });
});
