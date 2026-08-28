import Link from "next/link";
import { notFound } from "next/navigation";
import { isDbConfigured } from "@/lib/db";
import { isUuid } from "@/lib/ids";
import {
  getProject,
  lifelineData,
  linkedYearGoals,
  listDocuments,
  listMilestones,
  listProjectTasks,
  projectTimeSummary,
} from "@/lib/projects/repo";
import { listPlatforms } from "@/lib/ops/repo";
import { toDateKey } from "@/lib/dates";
import { ProjectHeader } from "@/components/projects/project-header";
import { OverviewTab } from "@/components/projects/overview-tab";
import { KanbanTab } from "@/components/projects/kanban-tab";
import { DocsTab } from "@/components/projects/docs-tab";
import { LifelineBar } from "@/components/projects/lifeline-bar";

// 회고 탭은 G4와 함께 v0.6 — 미구현 메뉴는 숨긴다 (ISSUE-11)
const TABS = [
  { key: "overview", label: "개요" },
  { key: "tasks", label: "태스크" },
  { key: "docs", label: "문서" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

// 프로젝트 상세 — 탭 4개 고정, 탭은 URL 딥링크 (§3). 생애 타임라인은 v0.5
export default async function ProjectDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { id } = await params;
  if (!isUuid(id) || !isDbConfigured()) notFound();

  const project = await getProject(id).catch(() => null);
  if (!project) notFound();

  const { tab: rawTab } = await searchParams;
  const tab: TabKey = TABS.some((t) => t.key === rawTab) ? (rawTab as TabKey) : "overview";

  const [milestones, tasks, docs, time, yearGoals, lifeline, platforms] = await Promise.all([
    listMilestones(id),
    listProjectTasks(id),
    tab === "docs" ? listDocuments(id) : Promise.resolve([]),
    projectTimeSummary(id),
    linkedYearGoals(id),
    lifelineData(id).catch(() => ({ events: [], milestones: [], deployments: [] })),
    listPlatforms().catch(() => []),
  ]);
  const platformOptions = platforms.map((p) => ({ id: p.id, name: p.name }));

  return (
    <div className="flex flex-col gap-4">
      <ProjectHeader project={project} platforms={platformOptions} />
      <LifelineBar data={lifeline} today={toDateKey(new Date())} />

      <nav className="flex gap-0.5 self-start rounded-lg border border-line bg-surface p-0.5 text-xs">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={`/projects/${id}?tab=${t.key}`}
            className={
              t.key === tab
                ? "rounded-md bg-ink px-3 py-1 font-medium text-surface"
                : "px-3 py-1 text-muted hover:text-ink"
            }
          >
            {t.label}
          </Link>
        ))}
      </nav>

      {tab === "overview" && (
        <OverviewTab
          project={project}
          time={time}
          milestones={milestones}
          yearGoals={yearGoals}
          platforms={platformOptions}
        />
      )}
      {tab === "tasks" && <KanbanTab projectId={id} tasks={tasks} milestones={milestones} />}
      {tab === "docs" && <DocsTab projectId={id} docs={docs} />}
    </div>
  );
}
