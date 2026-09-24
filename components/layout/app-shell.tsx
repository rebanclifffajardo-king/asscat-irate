"use client";

import { useEffect, useState, type ReactNode } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { AppSidebar, type ShellUser } from "./app-sidebar";
import { AppHeader } from "./app-header";
import { AppFooter } from "./app-footer";

export const SIDEBAR_COOKIE = "irate-sidebar";

/**
 * Responsive AdminLTE-style shell:
 *  - mobile (<768px): off-canvas drawer
 *  - tablet (768–1023px): icon rail
 *  - desktop (≥1024px): full sidebar, collapsible to a rail (remembered in a cookie)
 */
export function AppShell({ user, unread, initialCollapsed, children }: {
  user: ShellUser; unread: number; initialCollapsed: boolean; children: ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(initialCollapsed);
  const [drawer, setDrawer] = useState(false);
  // Close the drawer on Escape (links close it via onNavigate).
  useEffect(() => {
    if (!drawer) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setDrawer(false);
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = ""; };
  }, [drawer]);

  const toggle = () => {
    if (window.matchMedia("(max-width: 767px)").matches) {
      setDrawer((d) => !d);
      return;
    }
    setCollapsed((c) => {
      document.cookie = `${SIDEBAR_COOKIE}=${!c ? "collapsed" : "expanded"}; path=/; max-age=31536000; samesite=lax`;
      return !c;
    });
  };

  return (
    <div className="min-h-dvh">
      {/* Desktop / tablet sidebar */}
      <aside
        className={cn(
          "no-print fixed inset-y-0 left-0 z-40 hidden w-[4.5rem] shadow-xl transition-[width] duration-200 md:block",
          !collapsed && "lg:w-64",
        )}
      >
        <div className="h-full lg:hidden"><AppSidebar user={user} collapsed /></div>
        <div className="hidden h-full lg:block"><AppSidebar user={user} collapsed={collapsed} /></div>
      </aside>

      {/* Mobile drawer */}
      <div className={cn("no-print fixed inset-0 z-50 md:hidden", !drawer && "pointer-events-none")} aria-hidden={!drawer}>
        <div className={cn("absolute inset-0 bg-black/50 transition-opacity", drawer ? "opacity-100" : "opacity-0")} onClick={() => setDrawer(false)} />
        <aside
          className={cn("absolute inset-y-0 left-0 w-72 max-w-[85vw] shadow-2xl transition-transform duration-200", drawer ? "translate-x-0" : "-translate-x-full")}
          aria-label="Navigation drawer"
          inert={!drawer}
        >
          <button type="button" onClick={() => setDrawer(false)} className="absolute right-2 top-3 z-10 rounded p-1.5 text-gray-300 hover:bg-white/10" aria-label="Close navigation">
            <X className="h-5 w-5" />
          </button>
          <AppSidebar user={user} collapsed={false} onNavigate={() => setDrawer(false)} />
        </aside>
      </div>

      <div className={cn("flex min-h-dvh flex-col transition-[padding] duration-200 md:pl-[4.5rem]", !collapsed && "lg:pl-64")}>
        <AppHeader user={user} unread={unread} onToggleSidebar={toggle} />
        <main id="main" className="flex-1 px-3 py-5 sm:px-5 lg:px-6">{children}</main>
        <AppFooter />
      </div>
    </div>
  );
}
