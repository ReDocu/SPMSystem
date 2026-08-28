import { NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

// UptimeRobot 핑 대상 — Supabase 무활동 정지 방지를 위해 DB 조회를 반드시 포함한다 (기획서 §8.1)
export async function GET() {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ ok: true, db: "not_configured" });
  }

  const supabase = await createClient();
  const { error } = await supabase.from("daily_notes").select("id").limit(1);
  return NextResponse.json(
    { ok: !error, db: error ? "error" : "ok" },
    { status: error ? 500 : 200 },
  );
}
