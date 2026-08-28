import { describe, expect, test } from "vitest";
import { parseCapture } from "./parse";

// 기준일: 2026-08-27 (목)
const BASE = new Date(2026, 7, 27);

describe("parseCapture — 자동 추정 규칙 (기획서 §4.2)", () => {
  test("URL로 시작하면 자료로 추정한다", () => {
    const r = parseCapture("https://tailwindcss.com/docs 유틸리티 참고", BASE);
    expect(r.type).toBe("resource");
    expect(r.url).toBe("https://tailwindcss.com/docs");
    expect(r.title).toBe("유틸리티 참고");
  });

  test("URL만 있으면 제목은 URL 그대로 둔다 (메타 추출은 서버 몫)", () => {
    const r = parseCapture("https://supabase.com/docs/guides/auth", BASE);
    expect(r.type).toBe("resource");
    expect(r.title).toBe("https://supabase.com/docs/guides/auth");
  });

  test("코드 블록 형식은 스니펫으로 추정한다", () => {
    const r = parseCapture("```ts\nconst x = 1;\n```", BASE);
    expect(r.type).toBe("snippet");
  });

  test("'내일'은 할 일 + 다음 날 날짜로 파싱한다", () => {
    const r = parseCapture("내일까지 로그인 API", BASE);
    expect(r.type).toBe("task");
    expect(r.date).toBe("2026-08-28");
    expect(r.title).toBe("로그인 API");
  });

  test("요일은 다가오는 해당 요일로 파싱한다 (목요일 기준 금요일 → 다음 날)", () => {
    const r = parseCapture("금요일 블로그 초고", BASE);
    expect(r.type).toBe("task");
    expect(r.date).toBe("2026-08-28");
    expect(r.title).toBe("블로그 초고");
  });

  test("같은 요일을 말하면 다음 주로 넘긴다", () => {
    const r = parseCapture("목요일 회의 준비", BASE);
    expect(r.date).toBe("2026-09-03");
  });

  test("M/D 형식 날짜를 파싱한다", () => {
    const r = parseCapture("8/29 배포 준비", BASE);
    expect(r.type).toBe("task");
    expect(r.date).toBe("2026-08-29");
    expect(r.title).toBe("배포 준비");
  });

  test("#프로젝트명이 있으면 프로젝트 태스크로 추정한다", () => {
    const r = parseCapture("결제 모듈 갈아엎기 #SPM", BASE);
    expect(r.type).toBe("project_task");
    expect(r.project).toBe("SPM");
    expect(r.title).toBe("결제 모듈 갈아엎기");
  });

  test("#프로젝트 + 날짜면 날짜 붙은 프로젝트 태스크", () => {
    const r = parseCapture("#SPM 내일 로그인 API", BASE);
    expect(r.type).toBe("project_task");
    expect(r.project).toBe("SPM");
    expect(r.date).toBe("2026-08-28");
    expect(r.title).toBe("로그인 API");
  });

  test("날짜 없이 시간 범위면 오늘 타임로그로 추정한다", () => {
    const r = parseCapture("14-16 SPM 개발", BASE);
    expect(r.type).toBe("timelog");
    expect(r.timeRange).toEqual({ startMin: 14 * 60, endMin: 16 * 60 });
    expect(r.title).toBe("SPM 개발");
  });

  test("분 단위 시간 범위도 파싱한다", () => {
    const r = parseCapture("14:30-16:00 미팅", BASE);
    expect(r.type).toBe("timelog");
    expect(r.timeRange).toEqual({ startMin: 870, endMin: 960 });
  });

  test("미래 날짜 + 시간 범위면 일정(event)으로 추정한다 — 날짜 규칙 우선", () => {
    const r = parseCapture("내일 14-16 회의", BASE);
    expect(r.type).toBe("event");
    expect(r.date).toBe("2026-08-28");
    expect(r.timeRange).toEqual({ startMin: 840, endMin: 960 });
    expect(r.title).toBe("회의");
  });

  test("끝 시각이 24를 넘으면 시간 범위로 보지 않는다 (8-29는 시간이 아니다)", () => {
    const r = parseCapture("8-29 정리", BASE);
    expect(r.type).toBe("idea");
  });

  test("그 외에는 아이디어로 추정한다", () => {
    const r = parseCapture("다크모드는 시스템 설정을 따라가게", BASE);
    expect(r.type).toBe("idea");
    expect(r.title).toBe("다크모드는 시스템 설정을 따라가게");
  });

  test("빈 문자열은 아이디어 + 빈 제목", () => {
    const r = parseCapture("   ", BASE);
    expect(r.type).toBe("idea");
    expect(r.title).toBe("");
  });
});
