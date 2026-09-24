"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { Bell, CheckCheck, CheckCircle2, Info, AlertTriangle, XCircle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatRelative } from "@/lib/format";
import {
  getNotifications, getUnreadCount, markAllNotificationsRead, markNotificationRead, type NotificationItem,
} from "@/app/actions/notifications";

const ICON = { info: Info, success: CheckCircle2, warning: AlertTriangle, error: XCircle };
const COLOR = { info: "text-lte-info", success: "text-brand-600", warning: "text-amber-500", error: "text-lte-danger" };

export function NotificationDropdown({ initialUnread }: { initialUnread: number }) {
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(initialUnread);
  const [items, setItems] = useState<NotificationItem[] | null>(null);
  const [pending, startTransition] = useTransition();
  const ref = useRef<HTMLDivElement>(null);

  const load = useCallback(() => {
    startTransition(async () => {
      const res = await getNotifications();
      setItems(res.items);
      setUnread(res.unread);
    });
  }, []);

  // Light polling keeps the badge fresh without realtime subscriptions.
  useEffect(() => {
    const t = setInterval(async () => {
      if (document.visibilityState === "visible") setUnread(await getUnreadCount());
    }, 60_000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDoc); document.removeEventListener("keydown", onKey); };
  }, [open]);

  const markOne = (n: NotificationItem) => {
    if (n.read_at) return;
    setItems((prev) => prev?.map((x) => (x.id === n.id ? { ...x, read_at: new Date().toISOString() } : x)) ?? null);
    setUnread((u) => Math.max(0, u - 1));
    void markNotificationRead(n.id);
  };

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => { const next = !open; setOpen(next); if (next) load(); }}
        className="relative rounded-md p-2 text-gray-600 hover:bg-gray-100 hover:text-gray-900"
        aria-label={`Notifications${unread ? ` (${unread} unread)` : ""}`}
        aria-expanded={open}
        aria-haspopup="dialog"
      >
        <Bell className="h-5 w-5" />
        {unread > 0 && (
          <span className="absolute right-0.5 top-0.5 min-w-[18px] rounded-full bg-lte-warning px-1 text-center text-[10px] font-bold leading-[18px] text-gray-900">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>
      {open && (
        <div
          role="dialog"
          aria-label="Notifications"
          className="fixed inset-x-2 top-14 z-50 rounded-md border border-gray-200 bg-white shadow-xl sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:mt-1 sm:w-96"
        >
          <div className="flex items-center justify-between border-b border-gray-100 px-4 py-2.5">
            <p className="text-sm font-semibold text-gray-800">{unread} unread notification{unread === 1 ? "" : "s"}</p>
            <button
              type="button"
              disabled={unread === 0}
              onClick={() => {
                setItems((prev) => prev?.map((x) => ({ ...x, read_at: x.read_at ?? new Date().toISOString() })) ?? null);
                setUnread(0);
                void markAllNotificationsRead();
              }}
              className="inline-flex items-center gap-1 text-xs font-semibold text-brand-600 hover:text-brand-700 disabled:opacity-40"
            >
              <CheckCheck className="h-3.5 w-3.5" /> Mark all as read
            </button>
          </div>
          <ul className="max-h-[60vh] overflow-y-auto">
            {items === null || (pending && items.length === 0) ? (
              <li className="flex justify-center py-8 text-gray-400"><Loader2 className="h-5 w-5 animate-spin" /></li>
            ) : items.length === 0 ? (
              <li className="px-4 py-8 text-center text-sm text-gray-500">You&apos;re all caught up.</li>
            ) : (
              items.map((n) => {
                const Icon = ICON[n.type] ?? Info;
                const body = (
                  <div className={cn("flex gap-3 px-4 py-3", !n.read_at && "bg-brand-50/60")}>
                    <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", COLOR[n.type])} aria-hidden />
                    <div className="min-w-0 flex-1">
                      <p className={cn("text-sm text-gray-900", !n.read_at && "font-semibold")}>{n.title}</p>
                      <p className="mt-0.5 text-xs text-gray-600">{n.message}</p>
                      <p className="mt-1 text-[11px] text-gray-400">{formatRelative(n.created_at)}</p>
                    </div>
                    {!n.read_at && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-brand-500" aria-label="Unread" />}
                  </div>
                );
                return (
                  <li key={n.id} className="border-b border-gray-50 last:border-0">
                    {n.link ? (
                      <Link href={n.link} onClick={() => { markOne(n); setOpen(false); }} className="block hover:bg-gray-50">{body}</Link>
                    ) : (
                      <button type="button" onClick={() => markOne(n)} className="block w-full text-left hover:bg-gray-50">{body}</button>
                    )}
                  </li>
                );
              })
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
