export function getSupabaseEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY. Copy .env.example to .env.local and fill it in.",
    );
  }
  return { url, anonKey };
}

/** Cookie that stores the "Remember me" choice ("0" = session-only cookies). */
export const REMEMBER_COOKIE = "irate-remember";

type CookieOptions = { maxAge?: number; expires?: Date; [key: string]: unknown };

/**
 * When the user did not tick "Remember me", auth cookies become session
 * cookies (cleared when the browser closes). Deletions (maxAge <= 0) are kept.
 */
export function applyRememberPreference<T extends CookieOptions>(options: T, remember: boolean): T {
  if (remember) return options;
  if (typeof options.maxAge === "number" && options.maxAge <= 0) return options;
  const rest = { ...options };
  delete rest.maxAge;
  delete rest.expires;
  return rest;
}
