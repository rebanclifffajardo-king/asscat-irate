import "server-only";
import { after } from "next/server";
import { headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import type { SessionUser } from "@/lib/auth/session";
import type { Json } from "@/types/database";

export type ActivityModule =
  | "Authentication" | "Dashboard" | "Survey" | "Questions" | "Categories" | "Students" | "Faculty"
  | "Subjects" | "Reports" | "Settings" | "Evaluation" | "Import" | "Profile" | "System";

type LogInput = {
  user: Pick<SessionUser, "id" | "displayName" | "role"> | null;
  action: string;
  module: ActivityModule;
  description?: string;
  entityType?: string;
  entityId?: string;
  metadata?: Record<string, Json | undefined>;
};

/**
 * Append-only audit log written with the service role (clients cannot insert
 * or forge entries). Runs after the response is sent; failures never break
 * the user's action. Never pass passwords or evaluation answers in metadata.
 */
export async function logActivity(input: LogInput) {
  const h = await headers();
  const ip = (h.get("x-forwarded-for")?.split(",")[0] ?? h.get("x-real-ip") ?? "").trim().slice(0, 64) || null;
  const userAgent = h.get("user-agent")?.slice(0, 300) ?? null;

  after(async () => {
    try {
      const admin = createAdminClient();
      const { error } = await admin.from("activity_logs").insert({
        user_id: input.user?.id ?? null,
        user_name: input.user?.displayName ?? null,
        role: input.user?.role ?? null,
        action: input.action.slice(0, 200),
        module: input.module,
        description: input.description?.slice(0, 1000) ?? null,
        entity_type: input.entityType ?? null,
        entity_id: input.entityId ?? null,
        ip_address: ip,
        user_agent: userAgent,
        metadata: (input.metadata ?? {}) as Json,
      });
      if (error) console.error("[activity-log]", error.message);
    } catch (e) {
      console.error("[activity-log]", e);
    }
  });
}
