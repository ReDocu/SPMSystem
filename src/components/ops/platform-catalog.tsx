"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CURRENCIES, COST_CYCLES, PLATFORM_CATEGORIES, type Platform, type PlatformCategory } from "@/lib/ops/model";

// 플랫폼 카탈로그 + 가격 체크 3단계: ① 가격 페이지 ↗ → ② 확인 입력 → ③ 저장 (O1)
export function PlatformCatalog({ items }: { items: Platform[] }) {
  const router = useRouter();
  const [filter, setFilter] = useState<PlatformCategory | null>(null);
  const [registering, setRegistering] = useState<Platform | null>(null);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ amount: "", currency: "USD", cycle: "monthly", nextBillingAt: "" });
  const [custom, setCustom] = useState({ name: "", category: PLATFORM_CATEGORIES[0] as string, homepageUrl: "", pricingUrl: "", freeTierNote: "" });
  const [error, setError] = useState<string | null>(null);

  const visible = filter ? items.filter((p) => p.category === filter) : items;

  const registerCost = async () => {
    if (!registering) return;
    setError(null);
    const amount = Number(form.amount);
    if (form.amount.trim() === "" || !Number.isFinite(amount) || amount < 0) {
      setError("금액을 확인해주세요 (무료는 0을 입력)");
      return;
    }
    const res = await fetch("/api/costs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: registering.name,
        amount,
        currency: form.currency,
        cycle: form.cycle,
        nextBillingAt: form.nextBillingAt || null,
        platformId: registering.id,
      }),
    }).catch(() => null);
    if (!res?.ok) {
      setError("저장하지 못했습니다");
      return;
    }
    setRegistering(null);
    setForm({ amount: "", currency: "USD", cycle: "monthly", nextBillingAt: "" });
    router.push("/ops/costs");
  };

  const addCustom = async () => {
    if (!custom.name.trim()) return;
    setError(null);
    const res = await fetch("/api/platforms", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(custom),
    }).catch(() => null);
    if (!res?.ok) {
      setError("저장하지 못했습니다");
      return;
    }
    setAdding(false);
    setCustom({ name: "", category: PLATFORM_CATEGORIES[0], homepageUrl: "", pricingUrl: "", freeTierNote: "" });
    router.refresh();
  };

  const inputCls = "rounded-md border border-line bg-surface px-2.5 py-1.5 text-xs outline-none focus:border-primary";

  return (
    <div className="flex max-w-3xl flex-col gap-3">
      <div className="flex items-center gap-1.5">
        <button
          onClick={() => setFilter(null)}
          className={`rounded-md px-2.5 py-1 text-xs ${filter === null ? "bg-surface-2 font-medium" : "text-muted hover:text-ink"}`}
        >
          전체
        </button>
        {PLATFORM_CATEGORIES.map((cat) => (
          <button
            key={cat}
            onClick={() => setFilter(cat)}
            className={`rounded-md px-2.5 py-1 text-xs ${filter === cat ? "bg-surface-2 font-medium" : "text-muted hover:text-ink"}`}
          >
            {cat}
          </button>
        ))}
        <span className="flex-1" />
        <button onClick={() => setAdding(!adding)} className="rounded-md border border-line px-2.5 py-1 text-xs text-muted hover:text-ink">
          + 직접 추가
        </button>
      </div>

      {error && <p className="text-xs text-muted">{error}</p>}

      {adding && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-dashed border-line bg-surface p-3">
          <input value={custom.name} onChange={(e) => setCustom({ ...custom, name: e.target.value })} placeholder="이름" className={`${inputCls} w-32`} />
          <select value={custom.category} onChange={(e) => setCustom({ ...custom, category: e.target.value })} className={inputCls}>
            {PLATFORM_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <input value={custom.homepageUrl} onChange={(e) => setCustom({ ...custom, homepageUrl: e.target.value })} placeholder="홈페이지 URL" className={`${inputCls} w-44`} />
          <input value={custom.pricingUrl} onChange={(e) => setCustom({ ...custom, pricingUrl: e.target.value })} placeholder="가격 페이지 URL" className={`${inputCls} w-44`} />
          <input value={custom.freeTierNote} onChange={(e) => setCustom({ ...custom, freeTierNote: e.target.value })} placeholder="무료 티어 메모" className={`${inputCls} min-w-0 flex-1`} />
          <button onClick={addCustom} className="rounded-md border border-ink px-3 py-1.5 text-xs font-medium hover:bg-surface-2">추가</button>
        </div>
      )}

      <ul className="overflow-hidden rounded-xl border border-line bg-surface">
        {visible.map((p) => (
          <li key={p.id} className="flex flex-col gap-2 border-b border-line/50 px-4 py-2.5 last:border-b-0">
            <div className="flex items-center gap-2.5 text-sm">
              <span className="w-40 flex-none truncate font-medium">
                {p.homepageUrl ? (
                  <a href={p.homepageUrl} target="_blank" rel="noopener noreferrer" className="hover:underline">{p.name}</a>
                ) : p.name}
                {p.isCustom && <span className="ml-1.5 rounded-full border border-line px-1.5 text-[10px] text-muted">직접 추가</span>}
              </span>
              <span className="min-w-0 flex-1 truncate text-xs text-muted">{p.freeTierNote}</span>
              {p.pricingUrl && (
                <a href={p.pricingUrl} target="_blank" rel="noopener noreferrer" className="flex-none rounded border border-line px-2 py-0.5 text-[11px] text-muted hover:text-ink">
                  가격 페이지 ↗
                </a>
              )}
              <button
                onClick={() => setRegistering(registering?.id === p.id ? null : p)}
                className="flex-none rounded border border-line px-2 py-0.5 text-[11px] text-muted hover:text-ink"
              >
                비용 등록
              </button>
            </div>
            {registering?.id === p.id && (
              <div className="flex flex-wrap items-center gap-2 rounded-lg bg-surface-2/60 p-2.5 text-xs">
                <span className="text-muted">② 확인한 가격:</span>
                <input value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} placeholder="0 = 무료 티어" inputMode="decimal" className={`${inputCls} w-28`} />
                <select value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })} className={inputCls}>
                  {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
                <select value={form.cycle} onChange={(e) => setForm({ ...form, cycle: e.target.value })} className={inputCls}>
                  {COST_CYCLES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
                <label className="flex items-center gap-1 text-muted">
                  갱신일
                  <input type="date" value={form.nextBillingAt} onChange={(e) => setForm({ ...form, nextBillingAt: e.target.value })} className={inputCls} />
                </label>
                <button onClick={registerCost} className="rounded-md border border-ink px-3 py-1.5 font-medium hover:bg-surface">
                  ③ 확인 (오늘로 기록)
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
