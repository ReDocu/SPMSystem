import Link from "next/link";
import { formatKoreanDate } from "@/lib/dates";
import { isDbConfigured } from "@/lib/db";
import { countUnprocessed } from "@/lib/inbox/repo";
import { resourceTileCounts } from "@/lib/resources/repo";
import { projectTileCounts } from "@/lib/projects/repo";
import { QuickCapture } from "@/components/quick-capture";

export const dynamic = "force-dynamic";

const EMPTY_PROJECT_TILE = { activeCount: 0, recent: null, hasOverdue: false };

// 메인 런처 — 사이드바 없음(관문 역할)
export default async function LauncherPage() {
  // 타일별로 격리 — 한 타일의 조회 실패가 다른 타일까지 0으로 만들면 안 된다
  const [inboxCount, resourceCounts, projectCounts] = isDbConfigured()
    ? await Promise.all([
        countUnprocessed().catch((error) => {
          console.error("런처 인박스 카운트 실패:", error);
          return 0;
        }),
        resourceTileCounts().catch((error) => {
          console.error("런처 자료수집 타일 실패:", error);
          return { weekCount: 0, ideaCount: 0 };
        }),
        projectTileCounts().catch((error) => {
          console.error("런처 프로젝트 타일 실패:", error);
          return EMPTY_PROJECT_TILE;
        }),
      ])
    : [0, { weekCount: 0, ideaCount: 0 }, EMPTY_PROJECT_TILE];

  const TILES = [
    { href: "/schedule", title: "일정", main: "오늘 남은 —", sub: "기록을 시작해보세요" },
    {
      href: "/projects",
      title: `프로젝트${projectCounts.hasOverdue ? " 🔴" : ""}`,
      main: `진행 중 ${projectCounts.activeCount}`,
      sub: projectCounts.recent
        ? `${projectCounts.recent.title} ${projectCounts.recent.progress}%`
        : "아이디어를 심어보세요",
    },
    { href: "/ops", title: "운영·배포", main: "v0.5 예정", sub: "", disabled: true },
    {
      href: "/resources",
      title: "자료수집",
      main: `이번 주 수집 ${resourceCounts.weekCount}`,
      sub: `아이디어 ${resourceCounts.ideaCount}건`,
    },
  ];

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-10 py-12">
      <header className="flex items-center justify-between">
        <h1 className="text-xl font-bold tracking-widest">SPM</h1>
        <span className="text-sm text-muted">{formatKoreanDate(new Date())}</span>
      </header>

      <div className="grid flex-1 grid-cols-1 gap-5 sm:grid-cols-2">
        {TILES.map((tile) =>
          tile.disabled ? (
            <div
              key={tile.title}
              className="flex flex-col gap-2 rounded-xl border border-dashed border-line bg-surface p-6 opacity-60"
            >
              <span className="text-sm font-medium">{tile.title}</span>
              <span className="text-sm text-muted">{tile.main}</span>
            </div>
          ) : (
            <Link
              key={tile.title}
              href={tile.href}
              className="flex flex-col gap-2 rounded-xl border border-line bg-surface p-6 transition-colors hover:border-primary"
            >
              <span className="text-sm font-medium">{tile.title}</span>
              <span className="text-2xl font-bold">{tile.main}</span>
              <span className="text-sm text-muted">{tile.sub}</span>
            </Link>
          ),
        )}
      </div>

      <div className="flex flex-col gap-1">
        <QuickCapture />
        <Link href="/inbox" className="px-2 text-xs text-muted hover:text-ink">
          📥 인박스 {inboxCount > 0 ? `${inboxCount}건 미처리` : "비어 있음 ✨"}
        </Link>
      </div>
    </div>
  );
}
