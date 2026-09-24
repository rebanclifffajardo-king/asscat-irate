import "server-only";
import { randomInt } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { UserFacingError } from "@/lib/actions";
import type { AppRole } from "./roles";

/**
 * Auth account administration. These use the service role and MUST only be
 * called after assertRole("admin") has succeeded.
 */

const UPPER = "ABCDEFGHJKLMNPQRSTUVWXYZ";
const LOWER = "abcdefghijkmnpqrstuvwxyz";
const DIGITS = "23456789";
const SYMBOLS = "@#$%&*!?";

/** Readable temporary password satisfying the password policy. */
export function generateTempPassword(length = 12): string {
  const all = UPPER + LOWER + DIGITS + SYMBOLS;
  const chars = [UPPER, LOWER, DIGITS, SYMBOLS].map((set) => set[randomInt(set.length)]);
  while (chars.length < length) chars.push(all[randomInt(all.length)]);
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join("");
}

function authError(message: string | undefined): UserFacingError {
  if (message?.toLowerCase().includes("already") && message.toLowerCase().includes("registered")) {
    return new UserFacingError("An account with this email address already exists.", { email: ["Email is already in use."] });
  }
  console.error("[auth-admin]", message);
  return new UserFacingError("The user account could not be updated. Please try again.");
}

export async function createAccount(input: { email: string; role: AppRole; firstName: string; lastName: string }) {
  const admin = createAdminClient();
  const tempPassword = generateTempPassword();
  const { data, error } = await admin.auth.admin.createUser({
    email: input.email,
    password: tempPassword,
    email_confirm: true,
    app_metadata: { role: input.role, must_change_password: true },
    user_metadata: { first_name: input.firstName, last_name: input.lastName },
  });
  if (error || !data.user) throw authError(error?.message);
  return { userId: data.user.id, tempPassword };
}

export async function deleteAccount(userId: string) {
  const admin = createAdminClient();
  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error) console.error("[auth-admin] delete", error.message);
}

export async function setAccountActive(userId: string, active: boolean) {
  const admin = createAdminClient();
  const { error: pErr } = await admin.from("profiles").update({ is_active: active }).eq("id", userId);
  if (pErr) throw authError(pErr.message);
  // Banning also revokes refresh tokens so existing sessions end promptly.
  const { error } = await admin.auth.admin.updateUserById(userId, { ban_duration: active ? "none" : "876000h" });
  if (error) throw authError(error.message);
}

export async function updateAccountEmail(userId: string, email: string) {
  const admin = createAdminClient();
  const { error } = await admin.auth.admin.updateUserById(userId, { email, email_confirm: true });
  if (error) throw authError(error.message);
}

export async function resetAccountPassword(userId: string) {
  const admin = createAdminClient();
  const tempPassword = generateTempPassword();
  const { error } = await admin.auth.admin.updateUserById(userId, { password: tempPassword });
  if (error) throw authError(error.message);
  const { error: pErr } = await admin.from("profiles").update({ must_change_password: true }).eq("id", userId);
  if (pErr) throw authError(pErr.message);
  return tempPassword;
}
