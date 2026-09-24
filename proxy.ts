import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    // Everything except static assets, image optimization, metadata files and
    // the cron endpoint (which authenticates with its own secret).
    "/((?!_next/static|_next/image|api/cron|favicon.ico|icon.svg|logo.svg|templates/|.*\\.(?:png|jpg|jpeg|gif|webp|svg|csv)$).*)",
  ],
};
