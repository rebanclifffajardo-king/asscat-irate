import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Resolves a login identifier (email, username, Student ID or Faculty ID) to the account
 * email. Uses the service role because the user is not signed in yet; returns
 * null for unknown IDs so callers can respond generically (no enumeration).
 */
export async function resolveLoginEmail(identifier: string): Promise<string | null> {
  const id = identifier.trim();
  if (id.includes("@")) return id.toLowerCase();
  if (!/^[A-Za-z0-9][A-Za-z0-9\-_.]{0,29}$/.test(id)) return null;

  const admin = createAdminClient();
  const pattern = id.replace(/[\\%_]/g, (m) => `\\${m}`); // literal, case-insensitive match

  // 1) Optional account username (e.g. "admin").
  const { data: byUsername } = await admin.from("profiles").select("email").ilike("username", pattern).maybeSingle();
  if (byUsername?.email) return byUsername.email;

  // 2) Student ID / Faculty ID.
  const [{ data: student }, { data: faculty }] = await Promise.all([
    admin.from("students").select("profile_id").ilike("student_number", pattern).not("profile_id", "is", null).maybeSingle(),
    admin.from("faculty").select("profile_id").ilike("faculty_number", pattern).not("profile_id", "is", null).maybeSingle(),
  ]);
  const profileId = student?.profile_id ?? faculty?.profile_id;
  if (!profileId) return null;
  const { data: profile } = await admin.from("profiles").select("email").eq("id", profileId).maybeSingle();
  return profile?.email ?? null;
}
