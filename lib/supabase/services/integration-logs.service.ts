import type { Json } from "@/types/database";
import type { IntegrationPlatform } from "@/utils/integrations";
import { getOptionalDataContext } from "./context";
import { logIntegrationEvent } from "./integration-events.service";

export async function logIntegrationAction(params: {
  platform: IntegrationPlatform;
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

  const eventType =
    params.actionType === "connect" || params.actionType === "disconnect"
      ? "connection"
      : params.actionType === "sync"
        ? "sync"
        : params.status === "pending_approval"
          ? "auto_action"
          : params.status === "error"
            ? "failure"
            : "sync";

  await logIntegrationEvent({
    platform: params.platform,
    eventType,
    status:
      params.status === "error"
        ? "error"
        : params.status === "pending_approval"
          ? "info"
          : "success",
    title: params.actionType,
    message: params.message,
    details: params.details,
  });
}
