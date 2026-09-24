import type { ReactNode } from "react";
import { cookies } from "next/headers";
import { requireRole } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import type { AppRole } from "@/lib/auth/roles";
import { AppShell, SIDEBAR_COOKIE } from "./app-shell";

/** Server layout for a role area: authorizes on the server, then renders the shell. */
export async function RoleLayout({ role, children }: { role: AppRole; children: ReactNode }) {
  const user = await requireRole(role);
  const supabase = await createClient();
  const [{ count }, cookieStore] = await Promise.all([
    supabase.from("notifications").select("id", { count: "exact", head: true }).is("read_at", null),
    cookies(),
  ]);
  const collapsed = cookieStore.get(SIDEBAR_COOKIE)?.value === "collapsed";

  return (
    <AppShell
      user={{ displayName: user.displayName, email: user.email, role: user.role, avatarUrl: user.avatarUrl, recordNumber: user.recordNumber }}
      unread={count ?? 0}
      initialCollapsed={collapsed}
    >
      {children}
    </AppShell>
  );
}
