"use server";

import { redirect } from "next/navigation";
import { cookies, headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { REMEMBER_COOKIE } from "@/lib/supabase/env";
import { resolveLoginEmail } from "@/lib/auth/resolve";
import { getSessionUser } from "@/lib/auth/session";
import { safeNextPath, isAppRole, ROLE_HOME } from "@/lib/auth/roles";
import { logActivity } from "@/lib/activity";
import { forgotPasswordSchema, loginSchema, newPasswordSchema, changePasswordSchema } from "@/lib/validation/auth";
import { formToObject } from "@/lib/actions";
import { z } from "zod";

export type FormState = { error?: string; fieldErrors?: Record<string, string[] | undefined>; success?: string } | undefined;

const GENERIC_LOGIN_ERROR = "Invalid login credentials. Please check your email/ID and password.";

export async function login(_: FormState, formData: FormData): Promise<FormState> {
  const parsed = loginSchema.safeParse(formToObject(formData));
  if (!parsed.success) return { fieldErrors: z.flattenError(parsed.error).fieldErrors };
  const { identifier, password, remember, next } = parsed.data;

  const email = await resolveLoginEmail(identifier);
  if (!email) return { error: GENERIC_LOGIN_ERROR };

  const cookieStore = await cookies();
  cookieStore.set(REMEMBER_COOKIE, remember ? "1" : "0", {
    httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/",
    ...(remember ? { maxAge: 60 * 60 * 24 * 30 } : {}),
  });

  const supabase = await createClient({ remember });
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.user) {
    if (error?.code === "over_request_rate_limit" || error?.status === 429) {
      return { error: "Too many login attempts. Please wait a few minutes and try again." };
    }
    return { error: GENERIC_LOGIN_ERROR };
  }

  const role = data.user.app_metadata?.role;
  const { data: profile } = await supabase.from("profiles").select("is_active, role").eq("id", data.user.id).maybeSingle();
  if (!profile || !profile.is_active || !isAppRole(role)) {
    await supabase.auth.signOut();
    return { error: "Your account is inactive or does not have access to ASSCAT iRATE. Please contact the administrator." };
  }

  await supabase.rpc("touch_last_login");
  const user = await getSessionUser();
  await logActivity({ user: user ?? { id: data.user.id, displayName: email, role: profile.role }, action: "Logged in", module: "Authentication" });

  if (data.user.app_metadata?.must_change_password) redirect("/change-password");
  redirect(safeNextPath(next, profile.role));
}

export async function requestPasswordReset(_: FormState, formData: FormData): Promise<FormState> {
  const parsed = forgotPasswordSchema.safeParse(formToObject(formData));
  if (!parsed.success) return { fieldErrors: z.flattenError(parsed.error).fieldErrors };

  const email = await resolveLoginEmail(parsed.data.identifier);
  if (email) {
    const h = await headers();
    const origin = process.env.NEXT_PUBLIC_SITE_URL ?? `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host")}`;
    const supabase = await createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${origin}/auth/confirm?next=/reset-password`,
    });
    if (error) console.error("[password-reset]", error.message);
  }
  // Same response whether or not the account exists (prevents enumeration).
  return { success: "If an account matches, a password reset link has been sent to its email address." };
}

/** Sets a new password during the email recovery flow (user has a recovery session). */
export async function resetPassword(_: FormState, formData: FormData): Promise<FormState> {
  const parsed = newPasswordSchema.safeParse(formToObject(formData));
  if (!parsed.success) return { fieldErrors: z.flattenError(parsed.error).fieldErrors };
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { error: "Your reset link has expired. Please request a new one." };

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return { error: error.message.includes("different") ? "New password must be different from the old password." : "Could not update the password. Please try again." };
  await supabase.rpc("complete_password_change");
  await supabase.auth.refreshSession();
  const user = await getSessionUser();
  await logActivity({ user, action: "Reset password via email", module: "Authentication" });
  redirect(user ? ROLE_HOME[user.role] : "/login");
}

/** Forced first-login change and voluntary change (re-authenticates first). */
export async function changePassword(_: FormState, formData: FormData): Promise<FormState> {
  const parsed = changePasswordSchema.safeParse(formToObject(formData));
  if (!parsed.success) return { fieldErrors: z.flattenError(parsed.error).fieldErrors };
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user?.email) redirect("/login");

  const { error: reauth } = await supabase.auth.signInWithPassword({ email: auth.user.email, password: parsed.data.current });
  if (reauth) return { fieldErrors: { current: ["Current password is incorrect."] } };

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return { error: "Could not update the password. Please try again." };
  await supabase.rpc("complete_password_change");
  await supabase.auth.refreshSession();

  const user = await getSessionUser();
  await logActivity({ user, action: "Changed password", module: "Authentication" });
  if (formData.get("mode") === "forced" && user) redirect(ROLE_HOME[user.role]);
  return { success: "Your password has been changed." };
}
