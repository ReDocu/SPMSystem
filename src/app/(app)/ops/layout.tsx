"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/ops", label: "대시보드" },
  { href: "/ops/platforms", label: "플랫폼" },
  { href: "/ops/environments", label: "환경" },
  { href: "/ops/deployments", label: "배포" },
  { href: "/ops/costs", label: "비용" },
];

export default function OpsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <div className="flex flex-col gap-4">
      <nav className="flex gap-0.5 self-start rounded-lg border border-line bg-surface p-0.5 text-xs">
        {NAV.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={
              pathname === item.href
                ? "rounded-md bg-ink px-3 py-1 font-medium text-surface"
                : "px-3 py-1 text-muted hover:text-ink"
            }
          >
            {item.label}
          </Link>
        ))}
      </nav>
      {children}
    </div>
  );
}
