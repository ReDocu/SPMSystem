export interface LifelineEvent {
  toStatus: string;
  occurredAt: string; // YYYY-MM-DD
}

export interface LifelineSegment {
  status: string;
  from: string;
  to: string;
  ratio: number; // 전체 기간 대비 체류 비율
}

export interface LifelineMarker {
  kind: "milestone" | "deploy";
  title: string;
  date: string;
  position: number; // 0~1
}

export interface Lifeline {
  segments: LifelineSegment[];
  markers: LifelineMarker[];
  totalDays: number;
}

const dayDiff = (from: string, to: string) =>
  Math.round((new Date(to).getTime() - new Date(from).getTime()) / 86_400_000);

/**
 * 생애 타임라인 — 입력 없이 기존 데이터에서 자동 생성 (상세기획 §5.5).
 * project_events 전이 이력 → 상태 체류 구간, 마일스톤◆·배포▲는 위치 마커로 겹친다.
 */
export function buildLifeline(
  events: LifelineEvent[],
  milestones: { title: string; date: string }[],
  deployments: { title: string; date: string }[],
  today: string,
): Lifeline {
  const sorted = [...events].sort((a, b) => a.occurredAt.localeCompare(b.occurredAt));
  if (sorted.length === 0) return { segments: [], markers: [], totalDays: 0 };

  const start = sorted[0].occurredAt;
  const end = today;
  const totalDays = Math.max(dayDiff(start, end), 1);

  const segments: LifelineSegment[] = sorted.map((event, i) => {
    const from = event.occurredAt;
    const to = i + 1 < sorted.length ? sorted[i + 1].occurredAt : end;
    return { status: event.toStatus, from, to, ratio: Math.max(dayDiff(from, to), 0) / totalDays };
  });

  const toMarker = (kind: LifelineMarker["kind"]) => (m: { title: string; date: string }) => ({
    kind,
    title: m.title,
    date: m.date,
    position: dayDiff(start, m.date) / totalDays,
  });
  const markers = [
    ...milestones.map(toMarker("milestone")),
    ...deployments.map(toMarker("deploy")),
  ]
    .filter((m) => m.position >= 0 && m.position <= 1)
    .sort((a, b) => a.position - b.position);

  return { segments, markers, totalDays: dayDiff(start, end) };
}
