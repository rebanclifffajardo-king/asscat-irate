"use server";

import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/auth/session";
import { logActivity } from "@/lib/activity";
import { REMEMBER_COOKIE } from "@/lib/supabase/env";

export async function signOut() {
  const user = await getSessionUser();
  const supabase = await createClient();
  if (user) await logActivity({ user, action: "Logged out", module: "Authentication" });
  await supabase.auth.signOut();
  (await cookies()).delete(REMEMBER_COOKIE);
  redirect("/login");
}
