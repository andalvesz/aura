import type { Json } from "@/types/database";
import { getOptionalDataContext } from "./context";

export async function logIntegrationAction(params: {
  platform: "meta" | "kiwify";
  actionType: string;
  status: "success" | "error" | "pending_approval";
  message: string;
  details?: Record<string, unknown>;
}) {
  const ctx = await getOptionalDataContext();
  if (!ctx) return;

  await ctx.supabase.from("integration_action_logs").insert({
    user_id: ctx.userId,
    platform: params.platform,
    action_type: params.actionType,
    status: params.status,
    message: params.message,
    details: (params.details ?? {}) as Json,
  });
}
