import Link from "next/link";
import { notFound } from "next/navigation";
import { isDbConfigured } from "@/lib/db";
import { isUuid } from "@/lib/ids";
import {
  getProject,
  linkedYearGoals,
  listDocuments,
  listMilestones,
  listProjectTasks,
  projectTimeSummary,
} from "@/lib/projects/repo";
import { ProjectHeader } from "@/components/projects/project-header";
import { OverviewTab } from "@/components/projects/overview-tab";
import { KanbanTab } from "@/components/projects/kanban-tab";
import { DocsTab } from "@/components/projects/docs-tab";

const TABS = [
  { key: "overview", label: "개요" },
  { key: "tasks", label: "태스크" },
  { key: "docs", label: "문서" },
  { key: "retro", label: "회고" },
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

  const [milestones, tasks, docs, time, yearGoals] = await Promise.all([
    listMilestones(id),
    listProjectTasks(id),
    tab === "docs" ? listDocuments(id) : Promise.resolve([]),
    projectTimeSummary(id),
    linkedYearGoals(id),
  ]);

  return (
    <div className="flex flex-col gap-4">
      <ProjectHeader project={project} />

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
        <OverviewTab project={project} time={time} milestones={milestones} yearGoals={yearGoals} />
      )}
      {tab === "tasks" && <KanbanTab projectId={id} tasks={tasks} milestones={milestones} />}
      {tab === "docs" && <DocsTab projectId={id} docs={docs} />}
      {tab === "retro" && (
        <div className="rounded-xl border border-line bg-surface p-10 text-center text-sm text-muted">
          프로젝트를 마치면 회고를 작성합니다 (v0.6)
        </div>
      )}
    </div>
  );
}
