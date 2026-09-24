import type { Metadata } from "next";
import { requireRole } from "@/lib/auth/session";
import { ProfilePage } from "@/components/profile/profile-page";

export const metadata: Metadata = { title: "My Profile" };

export default async function Page() {
  const user = await requireRole("faculty");
  return <ProfilePage user={user} />;
}
