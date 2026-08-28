import Link from "next/link";
import { isDbConfigured } from "@/lib/db";
import { toDateKey } from "@/lib/dates";
import { listCosts, listExpiring, liveProjectCards } from "@/lib/ops/repo";
import { formatCostSummary, isPriceStale, summarizeCosts } from "@/lib/ops/costs";

export const dynamic = "force-dynamic";

// 운영 대시보드 — live 살림살이 요약 (상세기획 §5)
export default async function OpsDashboardPage() {
  const today = toDateKey(new Date());
  const [cards, expiring, costs] = isDbConfigured()
    ? await Promise.all([
        liveProjectCards().catch(() => []),
        listExpiring(today).catch(() => []),
        listCosts().catch(() => []),
      ])
    : [[], [], []];

  const staleCount = costs.filter((c) => isPriceStale(c.priceCheckedAt, new Date())).length;

  return (
    <div className="flex max-w-3xl flex-col gap-4">
      <section>
        <h2 className="mb-2 text-[13px] font-bold">운영 중 (live)</h2>
        {cards.length === 0 ? (
          <div className="rounded-xl border border-line bg-surface p-8 text-center text-sm text-muted">
            운영 중인 프로젝트가 없습니다 — 프로젝트를 live로 전이하면 여기 나타납니다
          </div>
        ) : (
          <ul className="flex flex-col gap-2">
            {cards.map((card) => (
              <li key={card.projectId} className="rounded-xl border border-line bg-surface px-4 py-3">
                <div className="flex items-center gap-2 text-sm">
                  <span className="h-2.5 w-2.5 flex-none rounded-full" style={{ backgroundColor: card.color ?? "#999" }} />
                  <Link href={`/projects/${card.projectId}`} className="font-medium hover:underline">
                    {card.title}
                  </Link>
                  {card.latestDeploy && (
                    <span className="text-xs text-muted">
                      최근 배포 {card.latestDeploy.version} {card.latestDeploy.deployedAt}
                    </span>
                  )}
                </div>
                {card.environments.length === 0 ? (
                  // G3를 건너뛴 live — 소프트 강제의 뒷수습 (ISSUE-04)
                  <p className="mt-1.5 text-xs text-muted">
                    환경을 등록하세요 —{" "}
                    <Link href={`/ops/environments?project=${card.projectId}`} className="underline underline-offset-2 hover:text-ink">
                      환경 등록
                    </Link>
                    {" · "}
                    <Link href={`/projects/${card.projectId}`} className="underline underline-offset-2 hover:text-ink">
                      G3 카드 다시 열기
                    </Link>
                  </p>
                ) : (
                  <div className="mt-1.5 flex flex-wrap gap-3 text-xs text-muted">
                    {card.environments.map((env) => {
                      const dday = env.sslExpiresAt
                        ? Math.round((new Date(env.sslExpiresAt).getTime() - new Date(today).getTime()) / 86_400_000)
                        : null;
                      return (
                        <span key={env.id}>
                          {env.name}
                          {env.platformName && ` · ${env.platformName}`}
                          {env.domain && ` · ${env.domain}`}
                          {dday !== null && (
                            <span className={dday <= 7 ? "text-red-400" : dday <= 30 ? "text-amber-500" : ""}>
                              {" "}SSL D-{dday}
                            </span>
                          )}
                        </span>
                      );
                    })}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-xl border border-line bg-surface p-4">
        <h2 className="mb-2 text-[13px] font-bold">⚠ 만료 임박 (D-30)</h2>
        {expiring.length === 0 ? (
          <p className="text-xs text-muted">없음 ✨</p>
        ) : (
          <ul className="flex flex-col gap-1">
            {expiring.map((item) => (
              <li key={`${item.kind}-${item.label}`} className="flex items-center gap-2 text-xs">
                <span className={`flex-none font-mono ${item.daysLeft <= 7 ? "text-red-400" : "text-amber-500"}`}>
                  D-{item.daysLeft}
                </span>
                <span className="min-w-0 flex-1 truncate">{item.label}</span>
                <span className="flex-none text-muted">{item.date}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-xl border border-line bg-surface p-4">
        <h2 className="mb-2 text-[13px] font-bold">💰 비용 요약</h2>
        <p className="text-sm">{formatCostSummary(summarizeCosts(costs))}</p>
        {staleCount > 0 && (
          <p className="mt-1 text-xs text-muted">
            가격 재확인 필요 {staleCount}건 —{" "}
            <Link href="/ops/costs" className="underline underline-offset-2 hover:text-ink">
              비용 페이지
            </Link>
          </p>
        )}
      </section>
    </div>
  );
}
