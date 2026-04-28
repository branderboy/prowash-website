import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { getDb, SCHEMA_SQL } from "@/lib/db";

function authorized(req: NextRequest): boolean {
  const expected = process.env.ADMIN_SETUP_TOKEN;
  if (!expected) return false;
  const provided = req.headers.get("x-admin-token");
  if (!provided) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export async function POST(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  const sql = getDb();
  // The neon http driver doesn't run multi-statement strings in one call,
  // so we split on `;` and run each non-empty statement.
  const statements = SCHEMA_SQL.split(/;\s*$/m).map((s) => s.trim()).filter(Boolean);
  for (const stmt of statements) {
    // The driver function can be called as a regular function with a SQL string
    // for non-templated DDL.
    await (sql as unknown as (q: string) => Promise<unknown>)(stmt);
  }
  return NextResponse.json({ ok: true, statements: statements.length });
}
