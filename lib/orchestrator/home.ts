/**
 * Aura Home model — composes context, widgets, timeline, quick actions.
 */

import { buildGlobalContext } from "@/lib/orchestrator/context-builder";
import { prioritizeHomeWidgets } from "@/lib/orchestrator/dashboard";
import { buildQuickActions } from "@/lib/orchestrator/quick-actions";
import { buildGlobalTimeline, type TimelineInputEvent } from "@/lib/orchestrator/timeline";
import type {
  AuraHomeModel,
  AuraPersonality,
  GlobalContextSlice,
  SessionFocus,
} from "@/lib/orchestrator/types";
import {
  filterHomeWidgetsByCapabilities,
  getPlatformState,
} from "@/lib/capabilities";

export function buildAuraHome(input: {
  slice?: Partial<GlobalContextSlice>;
  session?: Partial<SessionFocus>;
  personality?: Partial<AuraPersonality>;
  timelineEvents?: TimelineInputEvent[];
  correlationId?: string;
}): AuraHomeModel {
  const context = buildGlobalContext({
    slice: input.slice,
    session: input.session,
    personality: input.personality,
    correlationId: input.correlationId,
  });

  const rawWidgets = prioritizeHomeWidgets(context);
  const widgetOrder = filterHomeWidgetsByCapabilities(
    rawWidgets,
    getPlatformState(),
    {
      userId: context.slice.user?.id ?? "anonymous",
      workspaceId: context.session.workspaceId,
      workspaceSlug: null,
      role: "owner",
      isWorkspaceMember: Boolean(context.session.workspaceId),
    }
  );
  const timeline = buildGlobalTimeline(input.timelineEvents ?? [], 20);

  return {
    title: "Aura Home",
    subtitle: `${context.answers.whoIsTheUser} · ${context.answers.whichWorkspace}`,
    context,
    widgetOrder,
    quickActions: buildQuickActions(),
    timeline,
    generatedAt: context.generatedAt,
  };
}
