import type { IntegrationEvent, Json } from "@/types/database";
import { getOptionalDataContext } from "./context";

export async function logIntegrationEvent(params: {
  platform: IntegrationEvent["platform"];
  eventType: IntegrationEvent["event_type"];
  status: IntegrationEvent["status"];
  title: string;
  message?: string;
  details?: Record<string, unknown>;
}) {
  const ctx = await getOptionalDataContext();
  if (!ctx) return;

  await ctx.supabase.from("integration_events").insert({
    user_id: ctx.userId,
    platform: params.platform,
    event_type: params.eventType,
    status: params.status,
    title: params.title,
    message: params.message ?? "",
    details: (params.details ?? {}) as Json,
  });
}
