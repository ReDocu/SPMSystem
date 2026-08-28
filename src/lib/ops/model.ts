// 클라이언트에서도 쓰는 운영·배포 타입·상수 (pg 격리)

export const PLATFORM_CATEGORIES = ["웹·클라우드", "게임", "모바일 스토어", "도메인·구독"] as const;
export type PlatformCategory = (typeof PLATFORM_CATEGORIES)[number];

export const COST_CYCLES = [
  { value: "monthly", label: "월" },
  { value: "yearly", label: "연" },
  { value: "once", label: "1회" },
] as const;

export const CURRENCIES = ["KRW", "USD", "EUR", "JPY"] as const;

export interface Platform {
  id: string;
  name: string;
  category: PlatformCategory;
  homepageUrl: string | null;
  pricingUrl: string | null;
  freeTierNote: string | null;
  isCustom: boolean;
}

export interface SecretMeta {
  key: string;
  location: string;
  purpose: string;
}

export interface Environment {
  id: string;
  projectId: string;
  projectTitle?: string;
  name: string;
  platformId: string | null;
  platformName?: string | null;
  host: string | null;
  domain: string | null;
  sslExpiresAt: string | null;
  secrets: SecretMeta[];
}

export interface ChecklistItem {
  item: string;
  checked: boolean;
}

export interface Deployment {
  id: string;
  environmentId: string;
  envName?: string;
  projectTitle?: string;
  version: string;
  deployedAt: string;
  changelog: string | null;
  rolledBack: boolean;
  checklistSnapshot: ChecklistItem[] | null;
}

/** 환경 삭제 undo 재료 — cascade로 사라지는 배포 이력까지 함께 백업한다. */
export interface EnvironmentBackup {
  environment: Environment;
  deployments: {
    id: string;
    version: string;
    deployedAt: string; // ISO
    changelog: string | null;
    rolledBack: boolean;
    checklistSnapshot: ChecklistItem[] | null;
  }[];
}

export interface Cost {
  id: string;
  projectId: string | null;
  platformId: string | null;
  platformName?: string | null;
  pricingUrl?: string | null;
  name: string;
  amount: number;
  currency: string;
  cycle: string;
  nextBillingAt: string | null;
  priceCheckedAt: string | null;
}
