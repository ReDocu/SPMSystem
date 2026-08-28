import { NextResponse } from "next/server";
import { getPool, isDbConfigured } from "@/lib/db";

export async function GET() {
  if (!isDbConfigured()) {
    return NextResponse.json({ ok: true, db: "not_configured" });
  }

  try {
    await getPool().query("select 1");
    return NextResponse.json({ ok: true, db: "ok" });
  } catch {
    return NextResponse.json({ ok: false, db: "error" }, { status: 500 });
  }
}
