import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { getSupabaseEnv } from "./env";

/**
 * Service-role client. BYPASSES RLS — server-only, and only for operations that
 * cannot be expressed through the user's session:
 *   - auth account administration (create/ban/delete users, reset passwords)
 *   - resolving Student/Faculty ID → email at login
 *   - writing tamper-proof activity logs
 *   - the scheduled notifications cron
 * Always authorize the caller BEFORE using this client.
 */
export function createAdminClient() {
  const { url } = getSupabaseEnv();
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) {
    throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY (server-only environment variable).");
  }
  return createClient<Database>(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
