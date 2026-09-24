import { RoleLayout } from "@/components/layout/role-layout";

export default function Layout({ children }: LayoutProps<"/faculty">) {
  return <RoleLayout role="faculty">{children}</RoleLayout>;
}
