import { NextResponse, type NextRequest } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Daily cron (see vercel.json): generates "period started", "closing soon",
 * "closed" and "results released" notifications. Idempotent.
 * Vercel sends `Authorization: Bearer $CRON_SECRET`.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  const ok = !!secret && auth.length === expected.length && timingSafeEqual(Buffer.from(auth), Buffer.from(expected));
  if (!ok) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const { data, error } = await admin.rpc("generate_scheduled_notifications");
  if (error) {
    console.error("[cron] notifications", error.message);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
  return NextResponse.json({ created: data ?? 0 });
}
