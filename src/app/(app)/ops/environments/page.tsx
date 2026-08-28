import { isDbConfigured } from "@/lib/db";
import { listEnvironments, listPlatforms } from "@/lib/ops/repo";
import { listProjectCards } from "@/lib/projects/repo";
import { EnvironmentsPanel } from "@/components/ops/environments-panel";

export const dynamic = "force-dynamic";

// 대시보드의 "환경 등록" 딥링크(?project=)로 폼의 프로젝트를 미리 선택한다
export default async function EnvironmentsPage({
  searchParams,
}: {
  searchParams: Promise<{ project?: string }>;
}) {
  const { project: initialProjectId } = await searchParams;
  const [environments, platforms, projects] = isDbConfigured()
    ? await Promise.all([
        listEnvironments().catch(() => []),
        listPlatforms().catch(() => []),
        listProjectCards().catch(() => []),
      ])
    : [[], [], []];
  return (
    <EnvironmentsPanel
      environments={environments}
      platforms={platforms.map((p) => ({ id: p.id, name: p.name }))}
      projects={projects.map((p) => ({ id: p.id, title: p.title }))}
      initialProjectId={initialProjectId ?? null}
    />
  );
}
