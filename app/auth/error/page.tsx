import type { Metadata } from "next";
import { ShieldAlert } from "lucide-react";
import { LogoMark } from "@/components/brand/Logo";
import { signOut } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Access denied" };

export default function AuthErrorPage() {
  return (
    <main className="flex min-h-dvh items-center justify-center p-6">
      <div className="max-w-md rounded-md bg-white p-8 text-center shadow-card">
        <LogoMark className="mx-auto h-14 w-14" />
        <ShieldAlert className="mx-auto mt-4 h-8 w-8 text-lte-danger" aria-hidden />
        <h1 className="mt-2 text-lg font-semibold text-gray-900">No access</h1>
        <p className="mt-1 text-sm text-gray-600">
          Your account is inactive or has not been assigned a role in ASSCAT iRATE. Please contact the system administrator.
        </p>
        <form action={signOut} className="mt-5">
          <Button type="submit">Back to login</Button>
        </form>
      </div>
    </main>
  );
}
