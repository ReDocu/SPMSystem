import { buildLifeline, type Lifeline } from "@/lib/projects/lifeline";
import { STATUS_COLORS } from "@/lib/projects/model";
import type { LifelineData } from "@/lib/projects/repo";
import { formatGuessDate } from "@/lib/capture/format";

const MARKER_GLYPH = { milestone: "◆", deploy: "▲" } as const;

// 생애 타임라인 — 입력 없이 자동 생성되는 상태 구간 바 + 마커 (§5.5, 서버 렌더)
export function LifelineBar({ data, today }: { data: LifelineData; today: string }) {
  const line: Lifeline = buildLifeline(data.events, data.milestones, data.deployments, today);
  if (line.segments.length === 0) return null;

  return (
    <div className="flex flex-col gap-1 rounded-xl border border-line bg-surface p-3.5">
      <div className="relative">
        <div className="flex h-4 w-full overflow-hidden rounded-md">
          {line.segments.map((seg, i) => (
            <div
              key={i}
              style={{
                width: `${Math.max(seg.ratio * 100, 2)}%`,
                backgroundColor: STATUS_COLORS[seg.status] ?? "#999",
              }}
              title={`${seg.status} — ${formatGuessDate(seg.from)} ~ ${formatGuessDate(seg.to)}`}
              className="h-full"
            />
          ))}
        </div>
        {line.markers.map((m, i) => (
          <span
            key={i}
            style={{ left: `${m.position * 100}%` }}
            title={`${m.kind === "milestone" ? "마일스톤" : "배포"} ${m.title} · ${formatGuessDate(m.date)}`}
            className="absolute -top-2 -translate-x-1/2 text-[10px]"
          >
            {MARKER_GLYPH[m.kind]}
          </span>
        ))}
      </div>
      <div className="flex items-center gap-2 text-[10px] text-muted">
        <span>{formatGuessDate(line.segments[0].from)}</span>
        <span className="flex-1" />
        {line.segments.map((seg) => (
          <span key={seg.status + seg.from} className="flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: STATUS_COLORS[seg.status] ?? "#999" }} />
            {seg.status}
          </span>
        ))}
        <span className="flex-1" />
        <span>{line.totalDays}일</span>
      </div>
    </div>
  );
}
