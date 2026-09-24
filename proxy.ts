import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    // Everything except static assets, image optimization, metadata files,
    // PWA files (manifest, service worker, offline page, icons — they must load
    // without a session) and the cron endpoint (which has its own secret).
    "/((?!_next/static|_next/image|api/cron|favicon.ico|icon.svg|logo.svg|templates/|icons/|manifest.webmanifest|sw.js|offline.html|.*\\.(?:png|jpg|jpeg|gif|webp|svg|csv)$).*)",
  ],
};
