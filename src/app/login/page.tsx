"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

// PIN 잠금 — 소셜 로그인 없음 (기획서 v0.3, 화면명세서 §1)
export default function LoginPage() {
  const router = useRouter();
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pin }),
    });
    if (res.ok) {
      router.push("/");
      router.refresh();
    } else {
      setError("PIN이 올바르지 않습니다");
      setPin("");
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4">
      <h1 className="text-4xl font-bold tracking-[0.3em]">SPM</h1>
      <p className="text-sm text-muted">Single Project Manager</p>
      <form onSubmit={submit} className="mt-6 flex items-center gap-2">
        <input
          type="password"
          inputMode="numeric"
          autoFocus
          value={pin}
          onChange={(e) => setPin(e.target.value)}
          placeholder="PIN"
          className="w-40 rounded-lg border border-line bg-surface px-4 py-2.5 text-center text-sm tracking-[0.5em] outline-none focus:border-primary"
        />
        <button
          type="submit"
          className="rounded-lg border border-ink px-5 py-2.5 text-sm font-medium hover:bg-surface-2"
        >
          열기
        </button>
      </form>
      {error && <p className="text-sm text-danger">{error}</p>}
    </div>
  );
}
