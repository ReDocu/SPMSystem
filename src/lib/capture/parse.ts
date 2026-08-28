import { addDays, toDateKey } from "@/lib/dates";

export type CaptureType =
  | "resource"
  | "task"
  | "project_task"
  | "snippet"
  | "timelog"
  | "event"
  | "idea";

export interface TimeRange {
  startMin: number;
  endMin: number;
}

export interface CaptureGuess {
  type: CaptureType;
  title: string;
  url?: string;
  date?: string; // YYYY-MM-DD
  project?: string;
  timeRange?: TimeRange;
}

const URL_RE = /^(https?:\/\/\S+)/i;
const PROJECT_RE = /#([\p{L}\p{N}_-]+)/u;
const TIME_RANGE_RE = /(?:^|\s)(\d{1,2})(?::(\d{2}))?\s*[-~]\s*(\d{1,2})(?::(\d{2}))?(?=\s|$)/;
const MD_DATE_RE = /(?:^|\s)(\d{1,2})[/.](\d{1,2})(?=\s|$)/;
const RELATIVE_WORDS: Record<string, number> = { 오늘: 0, 내일: 1, 모레: 2 };
const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

interface DateMatch {
  date: string;
  token: string;
}

function parseDateToken(text: string, base: Date): DateMatch | null {
  const rel = text.match(/(오늘|내일|모레)(?:까지|에)?/);
  if (rel) {
    return { date: toDateKey(addDays(base, RELATIVE_WORDS[rel[1]])), token: rel[0] };
  }

  const wd = text.match(/([일월화수목금토])요일(?:까지|에)?/);
  if (wd) {
    const target = WEEKDAYS.indexOf(wd[1]);
    let ahead = (target - base.getDay() + 7) % 7;
    if (ahead === 0) ahead = 7;
    return { date: toDateKey(addDays(base, ahead)), token: wd[0] };
  }

  const md = text.match(MD_DATE_RE);
  if (md) {
    const month = Number(md[1]);
    const day = Number(md[2]);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return { date: toDateKey(new Date(base.getFullYear(), month - 1, day)), token: md[0].trim() };
    }
  }

  return null;
}

function parseTimeRange(text: string): { range: TimeRange; token: string } | null {
  const m = text.match(TIME_RANGE_RE);
  if (!m) return null;
  const startMin = Number(m[1]) * 60 + Number(m[2] ?? 0);
  const endMin = Number(m[3]) * 60 + Number(m[4] ?? 0);
  if (startMin >= endMin || endMin > 24 * 60 || Number(m[1]) > 23) return null;
  return { range: { startMin, endMin }, token: m[0].trim() };
}

function stripToken(text: string, token: string): string {
  return text.replace(token, " ").replace(/\s+/g, " ").trim();
}

/**
 * 기획서 §4.2 자동 추정 규칙.
 * 우선순위: URL > 코드 블록 > #프로젝트 > 날짜+시간(일정) > 시간(타임로그) > 날짜(할 일) > 아이디어.
 * 추정이 틀려도 인박스에서 재분류할 수 있으므로 확인 단계는 두지 않는다.
 */
export function parseCapture(raw: string, base: Date = new Date()): CaptureGuess {
  const text = raw.trim();
  if (!text) return { type: "idea", title: "" };

  const url = text.match(URL_RE);
  if (url) {
    const rest = stripToken(text, url[1]);
    return { type: "resource", url: url[1], title: rest || url[1] };
  }

  if (text.startsWith("```")) {
    return { type: "snippet", title: text.replace(/```[a-z]*\n?|```/g, "").trim() };
  }

  let title = text;
  const project = title.match(PROJECT_RE);
  if (project) title = stripToken(title, project[0]);

  const dateMatch = parseDateToken(title, base);
  if (dateMatch) title = stripToken(title, dateMatch.token);

  const timeMatch = parseTimeRange(title);
  if (timeMatch) title = stripToken(title, timeMatch.token);

  if (project) {
    return {
      type: "project_task",
      project: project[1],
      title,
      ...(dateMatch && { date: dateMatch.date }),
      ...(timeMatch && { timeRange: timeMatch.range }),
    };
  }

  if (dateMatch && timeMatch) {
    return { type: "event", date: dateMatch.date, timeRange: timeMatch.range, title };
  }

  if (timeMatch) {
    return { type: "timelog", timeRange: timeMatch.range, title };
  }

  if (dateMatch) {
    return { type: "task", date: dateMatch.date, title };
  }

  return { type: "idea", title: text };
}
