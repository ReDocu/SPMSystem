import { AppSidebar } from "@/components/app-sidebar";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <AppSidebar inboxCount={0} />
      <main className="min-w-0 flex-1 px-9 py-7">{children}</main>
    </div>
  );
}
