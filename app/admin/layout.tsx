import { RoleLayout } from "@/components/layout/role-layout";

export default function Layout({ children }: LayoutProps<"/admin">) {
  return <RoleLayout role="admin">{children}</RoleLayout>;
}
