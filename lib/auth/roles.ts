import type { Enums } from "@/types/database";

export type AppRole = Enums<"app_role">;

export const ROLE_HOME: Record<AppRole, string> = {
  admin: "/admin/dashboard",
  faculty: "/faculty/dashboard",
  student: "/student/dashboard",
};

export const ROLE_PREFIX: Record<AppRole, string> = {
  admin: "/admin",
  faculty: "/faculty",
  student: "/student",
};

export const ROLE_LABEL: Record<AppRole, string> = {
  admin: "Administrator",
  faculty: "Faculty",
  student: "Student",
};

export function isAppRole(value: unknown): value is AppRole {
  return value === "admin" || value === "faculty" || value === "student";
}

/** Returns a safe post-login path: same-origin and inside the role's area. */
export function safeNextPath(next: string | null | undefined, role: AppRole): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.includes("\\")) return ROLE_HOME[role];
  return next === ROLE_PREFIX[role] || next.startsWith(`${ROLE_PREFIX[role]}/`) ? next : ROLE_HOME[role];
}
