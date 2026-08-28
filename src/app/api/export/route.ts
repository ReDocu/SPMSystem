import { NextResponse } from "next/server";
import { getPool, isDbConfigured } from "@/lib/db";
import { toDateKey } from "@/lib/dates";

// JSON 전체 내보내기 — v0.1부터 유지되는 유일한 백업 수단 (기획서 §8.2)
const TABLES: Record<string, string> = {
  users: "created_at",
  projects: "created_at",
  tasks: "created_at",
  time_logs: "created_at",
  daily_notes: "date", // created_at 없음 (unique user_id+date)
  inbox_items: "created_at",
  resources: "created_at",
  milestones: "created_at",
  documents: "created_at",
  project_events: "occurred_at",
  schedules: "created_at",
  platforms: "created_at",
  environments: "created_at",
  deployments: "created_at",
  checklist_templates: "created_at",
  costs: "created_at",
  retrospectives: "created_at",
};

export async function GET() {
  if (!isDbConfigured()) return NextResponse.json({ error: "DB 미설정" }, { status: 503 });

  try {
    const pool = getPool();
    const dump: Record<string, unknown> = {
      exportedAt: new Date().toISOString(),
      version: "v0.2",
    };
    // 마이그레이션이 덜 된 DB에서도 존재하는 테이블은 전부 내보낸다 (백업은 all-or-nothing 금지)
    for (const [table, orderBy] of Object.entries(TABLES)) {
      const exists = await pool.query<{ ok: string | null }>(
        "select to_regclass($1)::text as ok",
        [`public.${table}`],
      );
      if (!exists.rows[0].ok) continue;
      const r = await pool.query(`select * from ${table} order by ${orderBy}`);
      dump[table] = r.rows;
    }
    return NextResponse.json(dump, {
      headers: {
        "Content-Disposition": `attachment; filename="spm-export-${toDateKey(new Date())}.json"`,
      },
    });
  } catch (error) {
    console.error("export 실패:", error);
    return NextResponse.json({ error: "내보내지 못했습니다" }, { status: 500 });
  }
}
