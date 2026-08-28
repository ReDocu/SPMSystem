import { AppSidebar } from "@/components/app-sidebar";
import { isDbConfigured } from "@/lib/db";
import { countUnprocessed } from "@/lib/inbox/repo";

// 사이드바 인박스 카운트가 빌드 시점에 굳지 않도록 (app) 전체를 동적 렌더링
export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  // DB 장애가 레이아웃을 죽이면 모든 페이지가 에러 화면이 된다 — 카운트는 0으로 강등
  const inboxCount = isDbConfigured()
    ? await countUnprocessed().catch((error) => {
        console.error("사이드바 인박스 카운트 실패:", error);
        return 0;
      })
    : 0;
  return (
    <div className="flex min-h-screen">
      <AppSidebar inboxCount={inboxCount} />
      <main className="min-w-0 flex-1 px-9 py-7">{children}</main>
    </div>
  );
}
