"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity, BarChart3, ClipboardCheck, ClipboardList, FolderTree, GraduationCap, HelpCircle,
  LayoutDashboard, LogOut, Settings, UserCircle, Users, type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { LogoMark } from "@/components/brand/Logo";
import { FacultyAvatar } from "@/components/ui/faculty-avatar";
import { signOut } from "@/app/actions/auth";
import type { AppRole } from "@/lib/auth/roles";
import { ROLE_HOME, ROLE_LABEL } from "@/lib/auth/roles";
import { NAV, type NavKey } from "./nav";

const ICONS: Record<NavKey, LucideIcon> = {
  dashboard: LayoutDashboard,
  survey: ClipboardList,
  questions: HelpCircle,
  categories: FolderTree,
  students: GraduationCap,
  faculty: Users,
  reports: BarChart3,
  settings: Settings,
  activity: Activity,
  results: BarChart3,
  profile: UserCircle,
  evaluations: ClipboardCheck,
};

export type ShellUser = {
  displayName: string;
  email: string;
  role: AppRole;
  avatarUrl: string | null;
  recordNumber: string | null;
};

type Props = { user: ShellUser; collapsed: boolean; onNavigate?: () => void };

/** AdminLTE-style dark sidebar. `collapsed` renders the icon rail. */
export function AppSidebar({ user, collapsed, onNavigate }: Props) {
  const pathname = usePathname();
  const items = NAV[user.role];

  const isActive = (href: string, match?: string[]) =>
    (match ?? [href]).some((m) => pathname === m || pathname.startsWith(`${m}/`));

  return (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-text">
      <Link
        href={ROLE_HOME[user.role]}
        onClick={onNavigate}
        className={cn("flex h-14 shrink-0 items-center border-b border-sidebar-border", collapsed ? "justify-center px-2" : "px-4")}
        aria-label="ASSCAT iRATE home"
      >
        {collapsed ? <LogoMark className="h-9 w-9 rounded bg-white p-0.5" /> : (
          <span className="inline-flex items-center gap-2">
            <LogoMark className="h-9 w-9 rounded-md bg-white p-0.5" />
            <span className="font-display text-lg font-extrabold tracking-tight text-white">
              ASSCAT <span className="text-brand-400">iRATE</span>
            </span>
          </span>
        )}
      </Link>

      <div className={cn("flex items-center gap-3 border-b border-sidebar-border py-3", collapsed ? "justify-center px-2" : "px-4")}>
        <FacultyAvatar name={user.displayName} src={user.avatarUrl} size="sm" className="ring-sidebar-border" />
        {!collapsed && (
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-white">{user.displayName}</p>
            <p className="truncate text-xs">{user.recordNumber ?? ROLE_LABEL[user.role]}</p>
          </div>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto py-2" aria-label="Main navigation">
        <ul className="space-y-0.5 px-2">
          {items.map((item) => {
            const Icon = ICONS[item.key];
            const active = isActive(item.href, item.match);
            return (
              <li key={item.key}>
                <Link
                  href={item.href}
                  onClick={onNavigate}
                  aria-current={active ? "page" : undefined}
                  title={collapsed ? item.label : undefined}
                  className={cn(
                    "flex items-center gap-3 rounded-md px-3 py-2.5 text-[15px] transition-colors",
                    collapsed && "justify-center px-0",
                    active ? "bg-brand-500 font-semibold text-white shadow" : "hover:bg-sidebar-hover hover:text-white",
                  )}
                >
                  <Icon className="h-[18px] w-[18px] shrink-0" aria-hidden />
                  <span className={cn(collapsed && "sr-only")}>{item.label}</span>
                </Link>
              </li>
            );
          })}
          <li className="pt-1">
            <form action={signOut}>
              <button
                type="submit"
                title={collapsed ? "Logout" : undefined}
                className={cn(
                  "flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-[15px] transition-colors hover:bg-sidebar-hover hover:text-white",
                  collapsed && "justify-center px-0",
                )}
              >
                <LogOut className="h-[18px] w-[18px] shrink-0" aria-hidden />
                <span className={cn(collapsed && "sr-only")}>Logout</span>
              </button>
            </form>
          </li>
        </ul>
      </nav>
    </div>
  );
}
