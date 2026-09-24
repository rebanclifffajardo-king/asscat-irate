import type { Metadata } from "next";
import { Card, CardBody } from "@/components/ui/card";
import { readParams } from "@/lib/url";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Log in" };

const NOTICES: Record<string, string> = {
  expired: "Your session has expired. Please log in again.",
  link_invalid: "That link is invalid or has expired. Please try again.",
};

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const params = await readParams(searchParams);
  return (
    <Card outline="brand" className="shadow-lg">
      <CardBody className="p-6 sm:p-8">
        <h1 className="text-xl font-semibold text-gray-900">Welcome back</h1>
        <p className="mb-6 mt-1 text-sm text-gray-500">Sign in to continue to ASSCAT iRATE.</p>
        <LoginForm next={params.next} notice={params.notice ? NOTICES[params.notice] : undefined} />
      </CardBody>
    </Card>
  );
}
