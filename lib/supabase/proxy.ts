import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/types/database";
import { ROLE_HOME, ROLE_PREFIX, isAppRole, type AppRole } from "@/lib/auth/roles";
import { applyRememberPreference, getSupabaseEnv, REMEMBER_COOKIE } from "./env";

const PROTECTED_PREFIXES = ["/admin", "/faculty", "/student", "/print", "/change-password", "/reset-password"];

/**
 * Refreshes the Supabase session cookie and performs OPTIMISTIC role routing
 * from the verified JWT claims. Every page, action and query re-authorizes on
 * the server/database (DAL + RLS) — this is only the first line of defense.
 */
export async function updateSession(request: NextRequest) {
  const { url, anonKey } = getSupabaseEnv();
  const remember = request.cookies.get(REMEMBER_COOKIE)?.value !== "0";
  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, applyRememberPreference(options, remember));
        }
      },
    },
  });

  // Do not run code between createServerClient and getClaims().
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  const { pathname, search } = request.nextUrl;

  const redirectTo = (path: string, params?: Record<string, string>) => {
    const target = request.nextUrl.clone();
    target.pathname = path;
    target.search = "";
    for (const [k, v] of Object.entries(params ?? {})) target.searchParams.set(k, v);
    const res = NextResponse.redirect(target);
    // Carry refreshed auth cookies over to the redirect.
    for (const c of response.cookies.getAll()) res.cookies.set(c);
    return res;
  };

  const needsAuth = pathname === "/" || PROTECTED_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));

  if (!claims) {
    if (needsAuth) {
      return redirectTo("/login", pathname === "/" ? {} : { next: pathname + search });
    }
    return response;
  }

  const appMeta = (claims.app_metadata ?? {}) as Record<string, unknown>;
  const role = isAppRole(appMeta.role) ? (appMeta.role as AppRole) : null;

  if (!role || appMeta.is_active === false) {
    // Authenticated but without an application role (or deactivated).
    if (needsAuth) return redirectTo("/auth/error", { reason: "no_access" });
    return response;
  }

  // Forced password change (accounts created with a temporary password).
  if (appMeta.must_change_password === true && pathname !== "/change-password" && !pathname.startsWith("/auth/")) {
    if (needsAuth || pathname === "/login") return redirectTo("/change-password");
  }

  if (pathname === "/" || pathname === "/login") {
    return redirectTo(ROLE_HOME[role]);
  }

  // Keep each role inside its own area.
  for (const [r, prefix] of Object.entries(ROLE_PREFIX) as [AppRole, string][]) {
    if (r !== role && (pathname === prefix || pathname.startsWith(`${prefix}/`))) {
      return redirectTo(ROLE_HOME[role]);
    }
  }

  return response;
}
