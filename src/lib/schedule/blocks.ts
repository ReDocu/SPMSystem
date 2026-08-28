export interface LogLike {
  id: string;
  startMin: number;
  endMin: number;
  content: string;
}

export interface MergedBlock {
  startMin: number;
  endMin: number;
  content: string;
  logIds: string[];
}

export interface DaySummary {
  totalMin: number;
  byTag: { tag: string; min: number }[];
  etcMin: number;
}

const TAG_RE = /#([\p{L}\p{N}_-]+)/u;

/** 연속된 같은 활동은 하나의 블록으로 표시한다 (상세기획 §4.3). */
export function mergeAdjacentLogs(logs: LogLike[]): MergedBlock[] {
  const sorted = [...logs].sort((a, b) => a.startMin - b.startMin);
  const blocks: MergedBlock[] = [];
  for (const log of sorted) {
    const last = blocks[blocks.length - 1];
    if (last && last.endMin === log.startMin && last.content === log.content) {
      blocks[blocks.length - 1] = {
        ...last,
        endMin: log.endMin,
        logIds: [...last.logIds, log.id],
      };
    } else {
      blocks.push({
        startMin: log.startMin,
        endMin: log.endMin,
        content: log.content,
        logIds: [log.id],
      });
    }
  }
  return blocks;
}

/** 하루 요약 — 총 시간 + 내용의 첫 #태그별 집계. 프로젝트 연결은 v0.3부터 (상세기획 §4.6). */
export function summarizeDay(logs: LogLike[]): DaySummary {
  let totalMin = 0;
  let etcMin = 0;
  const tagMin = new Map<string, number>();
  for (const log of logs) {
    const min = log.endMin - log.startMin;
    totalMin += min;
    const tag = log.content.match(TAG_RE)?.[1];
    if (tag) {
      tagMin.set(tag, (tagMin.get(tag) ?? 0) + min);
    } else {
      etcMin += min;
    }
  }
  const byTag = [...tagMin.entries()]
    .map(([tag, min]) => ({ tag, min }))
    .sort((a, b) => b.min - a.min);
  return { totalMin, byTag, etcMin };
}

function hours(min: number): string {
  const h = min / 60;
  return `${Number.isInteger(h) ? h : h.toFixed(1)}h`;
}

export function formatDaySummary(summary: DaySummary): string {
  if (summary.totalMin === 0) return "기록 0h — 빈 칸을 눌러 기록해보세요";
  const parts = [`기록 ${hours(summary.totalMin)}`];
  for (const { tag, min } of summary.byTag) parts.push(`#${tag} ${hours(min)}`);
  if (summary.etcMin > 0) parts.push(`기타 ${hours(summary.etcMin)}`);
  return parts.join(" · ");
}
