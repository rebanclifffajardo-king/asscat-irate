import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Card, CardBody } from "@/components/ui/card";
import { PasswordForm } from "@/components/auth/password-form";
import { createClient } from "@/lib/supabase/server";
import { resetPassword } from "../actions";

export const metadata: Metadata = { title: "Set a new password" };

export default async function ResetPasswordPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) redirect("/login?notice=link_invalid");
  return (
    <Card outline="brand" className="shadow-lg">
      <CardBody className="p-6 sm:p-8">
        <h1 className="text-xl font-semibold text-gray-900">Set a new password</h1>
        <p className="mb-6 mt-1 text-sm text-gray-500">Choose a strong password you haven&apos;t used before.</p>
        <PasswordForm action={resetPassword} requireCurrent={false} mode="reset" submitLabel="Save new password" />
      </CardBody>
    </Card>
  );
}
