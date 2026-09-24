import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Card, CardBody } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import { PasswordForm } from "@/components/auth/password-form";
import { getSessionUser } from "@/lib/auth/session";
import { ROLE_HOME } from "@/lib/auth/roles";
import { LogoutButton } from "@/components/auth/logout-button";
import { changePassword } from "../actions";

export const metadata: Metadata = { title: "Change password" };

/** Forced password change for accounts created with a temporary password. */
export default async function ChangePasswordPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (!user.mustChangePassword) redirect(ROLE_HOME[user.role]);
  return (
    <Card outline="warning" className="shadow-lg">
      <CardBody className="p-6 sm:p-8">
        <h1 className="text-xl font-semibold text-gray-900">Change your temporary password</h1>
        <Alert tone="warning" className="my-4">
          For your security, you must replace the temporary password provided by the administrator before continuing.
        </Alert>
        <PasswordForm action={changePassword} mode="forced" submitLabel="Update password and continue" />
        <div className="mt-4 text-center">
          <LogoutButton className="text-sm font-semibold text-gray-500 hover:text-gray-700 hover:underline">Log out</LogoutButton>
        </div>
      </CardBody>
    </Card>
  );
}
