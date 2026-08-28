import { AppSidebar } from "@/components/app-sidebar";
import { isDbConfigured } from "@/lib/db";
import { countUnprocessed } from "@/lib/inbox/repo";

// 사이드바 인박스 카운트가 빌드 시점에 굳지 않도록 (app) 전체를 동적 렌더링
export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const inboxCount = isDbConfigured() ? await countUnprocessed() : 0;
  return (
    <div className="flex min-h-screen">
      <AppSidebar inboxCount={inboxCount} />
      <main className="min-w-0 flex-1 px-9 py-7">{children}</main>
    </div>
  );
}
