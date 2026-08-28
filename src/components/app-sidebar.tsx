"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// v0.5: 4개 영역 전부 노출 (ISSUE-11 — 더 이상 숨길 미구현 영역 없음)
const NAV_ITEMS = [
  { href: "/schedule", label: "일정", match: /^\/schedule/ },
  { href: "/projects", label: "프로젝트", match: /^\/projects/ },
  { href: "/ops", label: "운영·배포", match: /^\/ops/ },
  { href: "/resources", label: "자료수집", match: /^\/resources/ },
] as const;
export function AppSidebar({ inboxCount = 0 }: { inboxCount?: number }) {
  const pathname = usePathname();

  const itemClass = (active: boolean) =>
    `flex items-center gap-2 rounded-md px-3 py-2 text-[13px] ${
      active ? "bg-surface-2 font-medium text-ink" : "text-muted hover:text-ink"
    }`;

  return (
    <aside className="flex w-56 flex-none flex-col gap-0.5 border-r border-line bg-surface px-3 py-4">
      <Link href="/" className="px-3 pb-4 pt-1 text-[15px] font-bold tracking-widest">
        SPM
      </Link>
      {NAV_ITEMS.map((item) => (
        <Link key={item.href} href={item.href} className={itemClass(item.match.test(pathname))}>
          {item.label}
        </Link>
      ))}
      <div className="mx-2 my-2 h-px bg-line" />
      <Link href="/inbox" className={`${itemClass(pathname === "/inbox")} justify-between`}>
        <span>인박스</span>
        {inboxCount > 0 && (
          <span className="rounded-full border border-line bg-surface-2 px-2 text-[11px]">
            {inboxCount}
          </span>
        )}
      </Link>
      <Link href="/stats" className={itemClass(pathname === "/stats")}>
        통계
      </Link>
      <Link href="/settings" className={itemClass(pathname === "/settings")}>
        설정
      </Link>
      <div className="flex-1" />
      <div className="rounded-md border border-dashed border-line px-3 py-2 text-center text-xs text-muted">
        ⌘K 빠른 입력
      </div>
    </aside>
  );
}
