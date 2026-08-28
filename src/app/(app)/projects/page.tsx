import { isDbConfigured } from "@/lib/db";
import { listProjectCards, type ProjectCard } from "@/lib/projects/repo";
import { ProjectCards } from "@/components/projects/project-cards";
import { NewProject } from "@/components/projects/new-project";

// 프로젝트 목록 — 4개 관리 그룹 (화면명세서 §5-1)
export default async function ProjectsPage() {
  let cards: ProjectCard[] = [];
  if (isDbConfigured()) {
    try {
      cards = await listProjectCards();
    } catch (error) {
      console.error("프로젝트 목록 실패:", error);
    }
  }

  return (
    <div className="flex max-w-4xl flex-col gap-4">
      <header className="flex items-center justify-between">
        <h1 className="text-lg font-bold">프로젝트</h1>
      </header>
      <NewProject />
      {cards.length === 0 ? (
        <div className="rounded-xl border border-line bg-surface p-10 text-center text-sm text-muted">
          첫 프로젝트를 만들어보세요
        </div>
      ) : (
        <ProjectCards cards={cards} />
      )}
    </div>
  );
}
