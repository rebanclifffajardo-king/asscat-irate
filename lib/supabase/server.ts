import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@/types/database";
import { applyRememberPreference, getSupabaseEnv, REMEMBER_COOKIE } from "./env";

/**
 * Supabase client bound to the signed-in user's session (RLS applies).
 * Use in Server Components, Server Actions and Route Handlers.
 */
export async function createClient(opts: { remember?: boolean } = {}) {
  // Read cookies first: this marks the route as dynamic, so a page is never
  // statically prerendered at build time (even if env vars are missing).
  const cookieStore = await cookies();
  const { url, anonKey } = getSupabaseEnv();
  const remember = opts.remember ?? cookieStore.get(REMEMBER_COOKIE)?.value !== "0";

  return createServerClient<Database>(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, applyRememberPreference(options, remember));
          }
        } catch {
          // Called from a Server Component: cookies are read-only there.
          // The proxy refreshes sessions, so this is safe to ignore.
        }
      },
    },
  });
}

export type ServerSupabase = Awaited<ReturnType<typeof createClient>>;
