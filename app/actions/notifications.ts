"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/auth/session";

export type NotificationItem = {
  id: string;
  title: string;
  message: string;
  type: "info" | "success" | "warning" | "error";
  link: string | null;
  read_at: string | null;
  created_at: string;
};

/** Latest notifications for the signed-in user (RLS: own rows only). */
export async function getNotifications(): Promise<{ items: NotificationItem[]; unread: number }> {
  const user = await getSessionUser();
  if (!user) return { items: [], unread: 0 };
  const supabase = await createClient();
  const [{ data }, { count }] = await Promise.all([
    supabase.from("notifications").select("id,title,message,type,link,read_at,created_at")
      .order("created_at", { ascending: false }).limit(20),
    supabase.from("notifications").select("id", { count: "exact", head: true }).is("read_at", null),
  ]);
  return { items: (data ?? []) as NotificationItem[], unread: count ?? 0 };
}

export async function getUnreadCount(): Promise<number> {
  const user = await getSessionUser();
  if (!user) return 0;
  const supabase = await createClient();
  const { count } = await supabase.from("notifications").select("id", { count: "exact", head: true }).is("read_at", null);
  return count ?? 0;
}

export async function markNotificationRead(id: string): Promise<void> {
  if (!z.uuid().safeParse(id).success) return;
  const user = await getSessionUser();
  if (!user) return;
  const supabase = await createClient();
  await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("id", id).is("read_at", null);
}

export async function markAllNotificationsRead(): Promise<void> {
  const user = await getSessionUser();
  if (!user) return;
  const supabase = await createClient();
  await supabase.from("notifications").update({ read_at: new Date().toISOString() }).is("read_at", null);
}
