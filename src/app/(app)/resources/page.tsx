import Link from "next/link";
import { isDbConfigured } from "@/lib/db";
import { categoryCounts, listResources, resourceTileCounts } from "@/lib/resources/repo";
import { DEFAULT_CATEGORIES, type Resource } from "@/lib/resources/model";
import { AddResource } from "@/components/resources/add-resource";
import { ResourceList } from "@/components/resources/resource-list";

interface SearchParams {
  cat?: string;
  q?: string;
  view?: string;
  type?: string;
}

// 자료수집 — 사이트 모음 + 아이디어 서랍 (화면명세서 §7)
export default async function ResourcesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const isIdeaView = params.type === "idea";
  const search = params.q?.trim() || undefined;
  const category = !isIdeaView && params.cat ? params.cat : undefined;

  let items: Resource[] = [];
  let counts: { category: string; count: number }[] = [];
  let ideaCount = 0;
  if (isDbConfigured()) {
    try {
      let tileCounts: { ideaCount: number };
      [items, counts, tileCounts] = await Promise.all([
        listResources({ type: isIdeaView ? "idea" : "site", category, search }),
        categoryCounts(),
        resourceTileCounts(),
      ]);
      ideaCount = tileCounts.ideaCount;
    } catch (error) {
      console.error("자료수집 로딩 실패:", error);
    }
  }

  const totalSites = counts.reduce((sum, c) => sum + c.count, 0);
  const countOf = (cat: string) => counts.find((c) => c.category === cat)?.count ?? 0;
  const filterClass = (active: boolean) =>
    `flex items-center justify-between rounded-md px-3 py-1.5 text-[13px] ${
      active ? "bg-surface-2 font-medium text-ink" : "text-muted hover:text-ink"
    }`;

  return (
    <div className="flex h-full gap-5">
      <aside className="flex w-40 flex-none flex-col gap-0.5">
        <Link href="/resources" className={filterClass(!isIdeaView && !category)}>
          <span>전체</span>
          <span className="text-[11px]">{totalSites}</span>
        </Link>
        {DEFAULT_CATEGORIES.map((cat) => (
          <Link
            key={cat}
            href={`/resources?cat=${encodeURIComponent(cat)}`}
            className={filterClass(category === cat)}
          >
            <span>{cat}</span>
            <span className="text-[11px]">{countOf(cat)}</span>
          </Link>
        ))}
        <div className="mx-2 my-2 h-px bg-line" />
        <Link href="/resources?type=idea" className={filterClass(isIdeaView)}>
          <span>아이디어</span>
          <span className="text-[11px]">{ideaCount}</span>
        </Link>
      </aside>

      <section className="flex min-w-0 flex-1 flex-col gap-4">
        <header className="flex items-center gap-3">
          <h1 className="text-lg font-bold">{isIdeaView ? "아이디어" : "자료수집"}</h1>
          <form className="min-w-0 flex-1" action="/resources">
            {isIdeaView && <input type="hidden" name="type" value="idea" />}
            {category && <input type="hidden" name="cat" value={category} />}
            <input
              type="search"
              name="q"
              defaultValue={search ?? ""}
              placeholder="검색 (제목·메모)"
              className="w-full max-w-64 rounded-md border border-line bg-surface px-3 py-1.5 text-xs outline-none focus:border-primary"
            />
          </form>
        </header>

        <AddResource isIdeaView={isIdeaView} category={category} />

        <ResourceList items={items} isIdeaView={isIdeaView} hasSearch={Boolean(search)} />
      </section>
    </div>
  );
}
