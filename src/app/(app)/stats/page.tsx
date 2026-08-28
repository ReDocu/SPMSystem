import { isDbConfigured } from "@/lib/db";
import { loadStats, type StatsData } from "@/lib/stats/repo";
import { formatGuessDate } from "@/lib/capture/format";

export const dynamic = "force-dynamic";

const hours = (min: number) => (Number.isInteger(min / 60) ? `${min / 60}h` : `${(min / 60).toFixed(1)}h`);
const CONDITION_EMOJI: Record<number, string> = { 4: "😀", 3: "🙂", 2: "😐", 1: "🙁" };

const EMPTY: StatsData = { weeks: [], byProject: [], doneTotal: 0, doneThisMonth: 0, conditions: [] };

// 통계 (v0.6) — 조용한 열람처: 기록 시간·프로젝트 배분·완료·컨디션
export default async function StatsPage() {
  const stats = isDbConfigured() ? await loadStats().catch(() => EMPTY) : EMPTY;
  const maxWeek = Math.max(...stats.weeks.map((w) => w.totalMin), 1);
  const maxProject = Math.max(...stats.byProject.map((p) => p.totalMin), 1);
  const conditionTotal = stats.conditions.reduce((sum, c) => sum + c.count, 0);

  return (
    <div className="flex max-w-2xl flex-col gap-4">
      <h1 className="text-lg font-bold">통계</h1>

      <section className="rounded-xl border border-line bg-surface p-4">
        <h2 className="mb-2.5 text-[13px] font-bold">주간 기록 시간 (최근 8주)</h2>
        {stats.weeks.length === 0 ? (
          <p className="text-xs text-muted">기록이 쌓이면 여기 나타납니다</p>
        ) : (
          <div className="flex flex-col gap-1.5">
            {stats.weeks.map((w) => (
              <div key={w.weekStart} className="flex items-center gap-2 text-xs">
                <span className="w-16 flex-none text-muted">{formatGuessDate(w.weekStart)}~</span>
                <div className="h-3 min-w-0 flex-1 overflow-hidden rounded-full bg-surface-2">
                  <div
                    className="h-full rounded-full bg-primary/60"
                    style={{ width: `${(w.totalMin / maxWeek) * 100}%` }}
                  />
                </div>
                <span className="w-12 flex-none text-right text-muted">{hours(w.totalMin)}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-xl border border-line bg-surface p-4">
        <h2 className="mb-2.5 text-[13px] font-bold">프로젝트별 누적 시간</h2>
        {stats.byProject.length === 0 ? (
          <p className="text-xs text-muted">타임로그에 #프로젝트명을 쓰면 집계됩니다</p>
        ) : (
          <div className="flex flex-col gap-1.5">
            {stats.byProject.map((p) => (
              <div key={p.title} className="flex items-center gap-2 text-xs">
                <span className="w-24 flex-none truncate">{p.title}</span>
                <div className="h-3 min-w-0 flex-1 overflow-hidden rounded-full bg-surface-2">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${(p.totalMin / maxProject) * 100}%`,
                      backgroundColor: p.color ?? "#B0AFAF",
                    }}
                  />
                </div>
                <span className="w-12 flex-none text-right text-muted">{hours(p.totalMin)}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      <div className="grid grid-cols-2 gap-4">
        <section className="rounded-xl border border-line bg-surface p-4">
          <h2 className="mb-1.5 text-[13px] font-bold">완료 태스크</h2>
          <p className="text-2xl font-bold">{stats.doneTotal}</p>
          <p className="text-xs text-muted">이번 달 {stats.doneThisMonth}</p>
        </section>
        <section className="rounded-xl border border-line bg-surface p-4">
          <h2 className="mb-1.5 text-[13px] font-bold">컨디션 (최근 30일)</h2>
          {conditionTotal === 0 ? (
            <p className="text-xs text-muted">일별 기록지에서 1탭</p>
          ) : (
            <div className="flex items-end gap-2">
              {stats.conditions.map((c) => (
                <div key={c.condition} className="flex flex-col items-center gap-0.5 text-xs">
                  <span className="text-muted">{c.count}</span>
                  <span className="text-lg">{CONDITION_EMOJI[c.condition]}</span>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
