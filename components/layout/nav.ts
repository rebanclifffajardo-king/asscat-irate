import type { AppRole } from "@/lib/auth/roles";

export type NavKey =
  | "dashboard" | "survey" | "questions" | "categories" | "students" | "faculty" | "reports"
  | "settings" | "activity" | "results" | "profile" | "evaluations";

export type NavItem = { key: NavKey; label: string; href: string; match?: string[] };

export const NAV: Record<AppRole, NavItem[]> = {
  admin: [
    { key: "dashboard", label: "Dashboard", href: "/admin/dashboard" },
    { key: "survey", label: "Survey", href: "/admin/surveys", match: ["/admin/surveys", "/admin/subjects"] },
    { key: "questions", label: "Questions", href: "/admin/questions" },
    { key: "categories", label: "Categories", href: "/admin/categories" },
    { key: "students", label: "Students", href: "/admin/students" },
    { key: "faculty", label: "Faculty", href: "/admin/faculty" },
    { key: "reports", label: "Reports", href: "/admin/reports" },
    { key: "settings", label: "Settings", href: "/admin/settings" },
    { key: "activity", label: "Activity Log", href: "/admin/activity-log" },
  ],
  faculty: [
    { key: "dashboard", label: "Dashboard", href: "/faculty/dashboard" },
    { key: "results", label: "Evaluation Results", href: "/faculty/results" },
    { key: "profile", label: "My Profile", href: "/faculty/profile" },
  ],
  student: [
    { key: "evaluations", label: "My Evaluations", href: "/student/dashboard", match: ["/student/dashboard", "/student/evaluate"] },
    { key: "profile", label: "My Profile", href: "/student/profile" },
  ],
};
