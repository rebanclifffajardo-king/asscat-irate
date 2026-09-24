"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown, KeyRound, LogOut, Menu, UserCircle } from "lucide-react";
import { DropdownMenu } from "@/components/ui/dropdown-menu";
import { FacultyAvatar } from "@/components/ui/faculty-avatar";
import { LogoMark } from "@/components/brand/Logo";
import { ROLE_LABEL, ROLE_PREFIX } from "@/lib/auth/roles";
import { LogoutDialog } from "@/components/auth/logout-button";
import { NotificationDropdown } from "./notification-dropdown";
import type { ShellUser } from "./app-sidebar";

export function AppHeader({ user, unread, onToggleSidebar }: { user: ShellUser; unread: number; onToggleSidebar: () => void }) {
  const base = ROLE_PREFIX[user.role];
  const [logout, setLogout] = useState(false);
  return (
    <header className="no-print sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-gray-200 bg-white px-2 sm:px-4">
      <button
        type="button"
        onClick={onToggleSidebar}
        className="rounded-md p-2 text-gray-600 hover:bg-gray-100 hover:text-gray-900"
        aria-label="Toggle navigation"
      >
        <Menu className="h-5 w-5" />
      </button>
      <Link href={`${base}/dashboard`} className="flex items-center gap-2 md:hidden" aria-label="ASSCAT iRATE home">
        <LogoMark className="h-7 w-7" />
        <span className="font-display text-base font-extrabold text-gray-800">ASSCAT <span className="text-brand-500">iRATE</span></span>
      </Link>

      <div className="ml-auto flex items-center gap-1 sm:gap-2">
        <NotificationDropdown initialUnread={unread} />
        <DropdownMenu
          label="Account"
          trigger={({ open, id, toggle, ref }) => (
            <button
              ref={ref}
              id={id}
              type="button"
              onClick={toggle}
              aria-haspopup="menu"
              aria-expanded={open}
              className="flex items-center gap-2 rounded-md py-1 pl-1 pr-2 hover:bg-gray-100"
            >
              <FacultyAvatar name={user.displayName} src={user.avatarUrl} size="xs" />
              <span className="hidden max-w-40 truncate text-sm font-semibold text-gray-700 sm:inline">{user.displayName}</span>
              <ChevronDown className="h-4 w-4 text-gray-400" aria-hidden />
            </button>
          )}
        >
          <div className="border-b border-gray-100 px-3 py-2">
            <p className="truncate text-sm font-semibold text-gray-900">{user.displayName}</p>
            <p className="truncate text-xs text-gray-500">{user.email}</p>
            <p className="mt-0.5 text-[11px] font-semibold uppercase tracking-wide text-brand-600">{ROLE_LABEL[user.role]}</p>
          </div>
          <Link role="menuitem" href={`${base}/profile`} className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 focus:bg-gray-100 focus:outline-none">
            <UserCircle className="h-4 w-4" /> My Profile
          </Link>
          <Link role="menuitem" href={`${base}/profile#password`} className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 focus:bg-gray-100 focus:outline-none">
            <KeyRound className="h-4 w-4" /> Change Password
          </Link>
          <div className="my-1 border-t border-gray-100" />
          <button role="menuitem" type="button" onClick={() => setLogout(true)} className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50 focus:bg-red-50 focus:outline-none">
            <LogOut className="h-4 w-4" /> Logout
          </button>
        </DropdownMenu>
      </div>
      <LogoutDialog open={logout} onClose={() => setLogout(false)} />
    </header>
  );
}
