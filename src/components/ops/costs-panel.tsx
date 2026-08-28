"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { Cost } from "@/lib/ops/model";
import { CURRENCIES, COST_CYCLES } from "@/lib/ops/model";
import { formatAmount, formatCostSummary, isPriceStale, summarizeCosts } from "@/lib/ops/costs";
import { formatGuessDate } from "@/lib/capture/format";
import { UndoToasts, useUndoQueue, type UndoEntry } from "@/components/undo-toast";

const CYCLE_LABEL: Record<string, string> = { monthly: "/월", yearly: "/년", once: " 1회" };

// 비용 — 통화별 병기 합계, 90일 경과 가격 흐림 + 재확인 (O3·O4). 무료도 0원 등록
export function CostsPanel({ costs }: { costs: Cost[] }) {
  const router = useRouter();
  const [recheckId, setRecheckId] = useState<string | null>(null);
  const [form, setForm] = useState({ amount: "", currency: "USD", cycle: "monthly", nextBillingAt: "" });
  const [error, setError] = useState<string | null>(null);
  const undoQueue = useUndoQueue<Cost>();
  const now = new Date();

  const startRecheck = (cost: Cost) => {
    setRecheckId(cost.id);
    setForm({
      amount: String(cost.amount),
      currency: cost.currency,
      cycle: cost.cycle,
      nextBillingAt: cost.nextBillingAt ?? "",
    });
  };

  const submitRecheck = async () => {
    if (!recheckId) return;
    setError(null);
    // 빈 값·오타("12,99")가 0원으로 저장되고 확인일까지 갱신되면 잘못된 가격이 90일 신뢰된다
    const amount = Number(form.amount);
    if (form.amount.trim() === "" || !Number.isFinite(amount) || amount < 0) {
      setError("금액을 확인해주세요 (무료는 0을 입력)");
      return;
    }
    const res = await fetch(`/api/costs/${recheckId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        amount,
        currency: form.currency,
        cycle: form.cycle,
        nextBillingAt: form.nextBillingAt || null,
      }),
    }).catch(() => null);
    if (!res?.ok) {
      setError("저장하지 못했습니다");
      return;
    }
    setRecheckId(null);
    router.refresh();
  };

  const handleDelete = async (cost: Cost) => {
    const res = await fetch(`/api/costs/${cost.id}`, { method: "DELETE" }).catch(() => null);
    if (!res?.ok) {
      setError("삭제하지 못했습니다");
      return;
    }
    const { item } = (await res.json()) as { item: Cost };
    undoQueue.push({ key: item.id, label: item.name, payload: item });
    router.refresh();
  };

  const handleUndo = async (entry: UndoEntry<Cost>) => {
    const cost = undoQueue.take(entry);
    await fetch(`/api/costs/${cost.id}/restore`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(cost),
    }).catch(() => null);
    router.refresh();
  };

  const inputCls = "rounded-md border border-line bg-surface px-2.5 py-1.5 text-xs outline-none focus:border-primary";

  return (
    <div className="flex max-w-3xl flex-col gap-3">
      <div className="rounded-xl border border-line bg-surface px-4 py-3 text-sm">
        {formatCostSummary(summarizeCosts(costs))}
      </div>
      {error && <p className="text-xs text-muted">{error}</p>}

      {costs.length === 0 ? (
        <div className="rounded-xl border border-line bg-surface p-8 text-center text-sm text-muted">
          비용이 없습니다 —{" "}
          <Link href="/ops/platforms" className="underline underline-offset-2 hover:text-ink">
            카탈로그에서 [비용 등록]
          </Link>
          으로 시작하세요 (무료 티어도 0원으로)
        </div>
      ) : (
        <ul className="overflow-hidden rounded-xl border border-line bg-surface">
          {costs.map((cost) => {
            const stale = isPriceStale(cost.priceCheckedAt, now);
            return (
              <li key={cost.id} className="group flex flex-col gap-1.5 border-b border-line/50 px-4 py-2.5 last:border-b-0">
                <div className="flex items-center gap-3 text-xs">
                  <span className="w-40 flex-none truncate font-medium">{cost.name}</span>
                  <span className={`w-28 flex-none font-mono ${stale ? "opacity-40" : ""}`}>
                    {cost.amount === 0 ? "무료" : formatAmount(cost.currency, cost.amount)}
                    {cost.amount === 0 ? "" : CYCLE_LABEL[cost.cycle]}
                  </span>
                  <span className="w-28 flex-none text-muted">
                    {cost.nextBillingAt ? `갱신 ${formatGuessDate(cost.nextBillingAt)}` : "—"}
                  </span>
                  <span className={`min-w-0 flex-1 truncate text-muted ${stale ? "opacity-60" : ""}`}>
                    {cost.priceCheckedAt ? `확인 ${formatGuessDate(cost.priceCheckedAt)}` : "미확인"}
                    {stale && " ⚠"}
                  </span>
                  {cost.pricingUrl && (
                    <a href={cost.pricingUrl} target="_blank" rel="noopener noreferrer" className="flex-none rounded border border-line px-1.5 py-0.5 text-[11px] text-muted hover:text-ink">
                      ↗
                    </a>
                  )}
                  <button onClick={() => startRecheck(cost)} className={`flex-none rounded border px-1.5 py-0.5 text-[11px] ${stale ? "border-ink font-medium" : "border-line text-muted opacity-0 group-hover:opacity-100"} hover:text-ink`}>
                    재확인
                  </button>
                  <button onClick={() => handleDelete(cost)} className="flex-none rounded border border-line px-1.5 py-0.5 text-[11px] text-muted opacity-0 hover:text-ink group-hover:opacity-100">
                    삭제
                  </button>
                </div>
                {recheckId === cost.id && (
                  <div className="flex flex-wrap items-center gap-2 rounded-lg bg-surface-2/60 p-2.5 text-xs">
                    <input value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} inputMode="decimal" className={`${inputCls} w-24`} />
                    <select value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })} className={inputCls}>
                      {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                    <select value={form.cycle} onChange={(e) => setForm({ ...form, cycle: e.target.value })} className={inputCls}>
                      {COST_CYCLES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                    </select>
                    <input type="date" value={form.nextBillingAt} onChange={(e) => setForm({ ...form, nextBillingAt: e.target.value })} className={inputCls} />
                    <button onClick={submitRecheck} className="rounded-md border border-ink px-3 py-1.5 font-medium hover:bg-surface">
                      확인 (오늘로 기록)
                    </button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <UndoToasts entries={undoQueue.entries} onUndo={handleUndo} />
    </div>
  );
}
