import type { Metadata } from "next";
import { Card, CardBody } from "@/components/ui/card";
import { ForgotForm } from "./forgot-form";

export const metadata: Metadata = { title: "Forgot password" };

export default function ForgotPasswordPage() {
  return (
    <Card outline="brand" className="shadow-lg">
      <CardBody className="p-6 sm:p-8">
        <h1 className="text-xl font-semibold text-gray-900">Forgot your password?</h1>
        <p className="mb-6 mt-1 text-sm text-gray-500">
          Enter your email or ID number and we&apos;ll send a password reset link to the email on your account.
        </p>
        <ForgotForm />
      </CardBody>
    </Card>
  );
}
