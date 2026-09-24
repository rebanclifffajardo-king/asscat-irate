import { ShieldCheck, BarChart3, EyeOff } from "lucide-react";
import { Logo } from "@/components/brand/Logo";

export default function AuthLayout({ children }: LayoutProps<"/">) {
  const year = Math.max(2026, new Date().getFullYear());
  return (
    <div className="grid min-h-dvh lg:grid-cols-[1.05fr_1fr]">
      <aside className="relative hidden overflow-hidden bg-gradient-to-br from-brand-700 via-brand-600 to-teal-brand p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="absolute -right-24 -top-24 h-96 w-96 rounded-full bg-white/10" aria-hidden />
        <div className="absolute -bottom-32 -left-16 h-96 w-96 rounded-full bg-white/5" aria-hidden />
        <div className="relative inline-flex w-fit rounded-xl bg-white px-5 py-4 shadow-lg">
          <Logo />
        </div>
        <div className="relative max-w-md">
          <h2 className="font-display text-3xl font-extrabold leading-tight">Faculty Evaluation System</h2>
          <p className="mt-3 text-white/85">
            A secure, confidential way for students to evaluate their instructors — and for the institution to turn that
            feedback into better teaching.
          </p>
          <ul className="mt-8 space-y-4 text-sm">
            <li className="flex items-center gap-3"><EyeOff className="h-5 w-5 text-white/90" aria-hidden /> Student identities are never shown to faculty</li>
            <li className="flex items-center gap-3"><ShieldCheck className="h-5 w-5 text-white/90" aria-hidden /> Role-based access protected at the database level</li>
            <li className="flex items-center gap-3"><BarChart3 className="h-5 w-5 text-white/90" aria-hidden /> Reliable analytics for every semester</li>
          </ul>
        </div>
        <p className="relative text-xs text-white/70">Copyright &copy; {year} ASSCAT iRATE. All rights reserved.</p>
      </aside>
      <main className="flex items-center justify-center bg-page px-4 py-10">
        <div className="w-full max-w-md">
          <div className="mb-6 flex justify-center lg:hidden"><Logo /></div>
          {children}
          <p className="mt-6 text-center text-xs text-gray-500 lg:hidden">Copyright &copy; {year} ASSCAT iRATE. All rights reserved.</p>
        </div>
      </main>
    </div>
  );
}
