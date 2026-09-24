import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { publicStorageUrl } from "@/lib/storage";
import { formatPersonName } from "@/lib/format";
import { ROLE_HOME, type AppRole } from "./roles";

export type SessionUser = {
  id: string;
  email: string;
  role: AppRole;
  mustChangePassword: boolean;
  displayName: string;
  firstName: string | null;
  middleName: string | null;
  lastName: string | null;
  avatarUrl: string | null;
  /** students.id / faculty.id for student and faculty accounts */
  recordId: string | null;
  /** Student ID / Faculty ID */
  recordNumber: string | null;
  programCode: string | null;
  programName: string | null;
  departmentName: string | null;
  yearLevel: string | null;
};

/**
 * Verified current user, loaded from the database (source of truth) and
 * memoized per request. Returns null when signed out, inactive or roleless.
 */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const uid = claimsData?.claims?.sub;
  if (!uid) return null;

  const { data: profile } = await supabase.from("profiles").select("*").eq("id", uid).maybeSingle();
  if (!profile || !profile.is_active) return null;

  const base = {
    id: profile.id,
    email: profile.email,
    role: profile.role,
    mustChangePassword: profile.must_change_password,
    avatarUrl: publicStorageUrl("avatars", profile.avatar_path),
    recordId: null,
    recordNumber: null,
    programCode: null,
    programName: null,
    departmentName: null,
    yearLevel: null,
  } satisfies Partial<SessionUser>;

  if (profile.role === "student") {
    const { data: s } = await supabase.from("student_overview").select("*").eq("profile_id", uid).maybeSingle();
    if (!s || !s.is_active) return null;
    return {
      ...base,
      firstName: s.first_name,
      middleName: s.middle_name,
      lastName: s.last_name,
      displayName: formatPersonName(s.first_name, s.middle_name, s.last_name),
      recordId: s.id,
      recordNumber: s.student_number,
      programCode: s.program_code,
      programName: s.program_name,
      departmentName: s.department_name,
      yearLevel: s.year_level_name,
    };
  }

  if (profile.role === "faculty") {
    const { data: f } = await supabase.from("faculty_overview").select("*").eq("profile_id", uid).maybeSingle();
    if (!f || !f.is_active) return null;
    return {
      ...base,
      firstName: f.first_name,
      middleName: f.middle_name,
      lastName: f.last_name,
      displayName: formatPersonName(f.first_name, f.middle_name, f.last_name),
      avatarUrl: publicStorageUrl("faculty-photos", f.photo_path) ?? base.avatarUrl,
      recordId: f.id,
      recordNumber: f.faculty_number,
      programCode: f.program_code,
      programName: f.program_name,
      departmentName: f.department_name,
      yearLevel: null,
    };
  }

  return {
    ...base,
    firstName: profile.first_name,
    middleName: profile.middle_name,
    lastName: profile.last_name,
    displayName: formatPersonName(profile.first_name, profile.middle_name, profile.last_name) || "Administrator",
  };
});

/** Page/layout guard: redirects when not signed in or not in an allowed role. */
export async function requireRole(roles: AppRole | AppRole[]): Promise<SessionUser> {
  const allowed = Array.isArray(roles) ? roles : [roles];
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.mustChangePassword) redirect("/change-password");
  if (!allowed.includes(user.role)) redirect(ROLE_HOME[user.role]);
  return user;
}

export class AuthorizationError extends Error {
  constructor(message = "You are not authorized to perform this action.") {
    super(message);
    this.name = "AuthorizationError";
  }
}

/** Server Action guard: throws (caught by runAction) instead of redirecting. */
export async function assertRole(roles: AppRole | AppRole[]): Promise<SessionUser> {
  const allowed = Array.isArray(roles) ? roles : [roles];
  const user = await getSessionUser();
  if (!user || user.mustChangePassword || !allowed.includes(user.role)) throw new AuthorizationError();
  return user;
}
