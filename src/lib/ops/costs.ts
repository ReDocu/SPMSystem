export interface CostLike {
  amount: number;
  currency: string;
  cycle: string; // monthly | yearly | once
}

export interface CostSummary {
  monthly: { currency: string; amount: number }[];
  yearly: { currency: string; amount: number }[];
}

const CURRENCY_SYMBOLS: Record<string, string> = { USD: "$", KRW: "₩", EUR: "€", JPY: "¥" };
const STALE_DAYS = 90;

function sumByCurrency(costs: CostLike[]): { currency: string; amount: number }[] {
  const map = new Map<string, number>();
  for (const c of costs) map.set(c.currency, (map.get(c.currency) ?? 0) + Number(c.amount));
  return [...map.entries()].map(([currency, amount]) => ({ currency, amount }));
}

/** 통화별 그대로 합산 (환율 변환 없음, O3). 연 주기는 월로 환산하지 않는다 (ISSUE-09). */
export function summarizeCosts(costs: CostLike[]): CostSummary {
  return {
    monthly: sumByCurrency(costs.filter((c) => c.cycle === "monthly")),
    yearly: sumByCurrency(costs.filter((c) => c.cycle === "yearly")),
  };
}

export function formatAmount(currency: string, amount: number): string {
  const symbol = CURRENCY_SYMBOLS[currency] ?? `${currency} `;
  return `${symbol}${amount.toLocaleString()}`;
}

/** "월 $25 + ₩3,300 · 연 $99" 한 줄. */
export function formatCostSummary(summary: CostSummary): string {
  const part = (label: string, items: CostSummary["monthly"]) =>
    items.length > 0 ? `${label} ${items.map((i) => formatAmount(i.currency, i.amount)).join(" + ")}` : null;
  const parts = [part("월", summary.monthly), part("연", summary.yearly)].filter(Boolean);
  return parts.length > 0 ? parts.join(" · ") : "등록된 비용 없음";
}

/** 확인 후 90일 경과(또는 미확인)면 흐리게 — 배지·알림은 쓰지 않는다 (O4). */
export function isPriceStale(priceCheckedAt: string | null, today: Date): boolean {
  if (!priceCheckedAt) return true;
  const checked = new Date(priceCheckedAt);
  return (today.getTime() - checked.getTime()) / 86_400_000 > STALE_DAYS;
}
