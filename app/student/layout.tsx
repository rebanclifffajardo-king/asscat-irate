import { RoleLayout } from "@/components/layout/role-layout";

export default function Layout({ children }: LayoutProps<"/student">) {
  return <RoleLayout role="student">{children}</RoleLayout>;
}
