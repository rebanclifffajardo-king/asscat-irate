import Link from "next/link";
import { LogoMark } from "@/components/brand/Logo";
import { buttonClasses } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center p-6 text-center">
      <LogoMark className="h-16 w-16" />
      <p className="mt-4 text-5xl font-bold text-brand-500">404</p>
      <h1 className="mt-2 text-xl font-semibold text-gray-800">Page not found</h1>
      <p className="mt-1 text-sm text-gray-600">The page you are looking for does not exist or you do not have access to it.</p>
      <Link href="/" className={buttonClasses("primary", "md", "mt-6")}>Go to my dashboard</Link>
    </main>
  );
}
