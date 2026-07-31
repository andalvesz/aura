/**
 * Platform persistence service — Supabase when available, memory fallback for tests.
 */

import {
  createEmptyPlatformState,
  getPlatformState,
  setPlatformState,
  type PlatformState,
} from "@/lib/capabilities/store";
import { isMemoryPlatformPersistence } from "@/lib/capabilities/persistence-mode";
import { ensureSystemTemplates } from "@/lib/capabilities/templates";
import { bootstrapCoreInstallations } from "@/lib/capabilities/resolver";
import { ensureBetaActive } from "@/lib/capabilities/beta-access";
import type {
  CapabilityInstallation,
  FeatureFlag,
  ResolveContext,
  SkillInstallation,
} from "@/lib/capabilities/types";
import { getDataContext } from "@/lib/supabase/services/context";
import { createClient } from "@/lib/supabase/server";
import { recordPlatformEvent } from "@/lib/capabilities/observability";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = any;

function mapCap(r: Record<string, unknown>): CapabilityInstallation {
  return {
    id: String(r.id),
    capabilityId: String(r.capability_id),
    userId: String(r.user_id),
    workspaceId: (r.workspace_id as string | null) ?? null,
    status: r.status as CapabilityInstallation["status"],
    installedVersion: String(r.installed_version),
    enabled: Boolean(r.enabled),
    config: (r.config as Record<string, unknown>) ?? {},
    errorMessage: (r.error_message as string | null) ?? null,
    installedAt: String(r.installed_at),
    enabledAt: (r.enabled_at as string | null) ?? null,
    disabledAt: (r.disabled_at as string | null) ?? null,
    updatedAt: String(r.updated_at),
    softDeleted: Boolean(r.soft_deleted),
  };
}

function mapSkill(r: Record<string, unknown>): SkillInstallation {
  return {
    id: String(r.id),
    skillId: String(r.skill_id),
    userId: String(r.user_id),
    workspaceId: (r.workspace_id as string | null) ?? null,
    status: r.status as SkillInstallation["status"],
    installedVersion: String(r.installed_version),
    enabled: Boolean(r.enabled),
    config: (r.config as Record<string, unknown>) ?? {},
    errorMessage: (r.error_message as string | null) ?? null,
    installedAt: String(r.installed_at),
    enabledAt: (r.enabled_at as string | null) ?? null,
    disabledAt: (r.disabled_at as string | null) ?? null,
    updatedAt: String(r.updated_at),
    softDeleted: Boolean(r.soft_deleted),
  };
}

export async function loadPlatformStateForContext(
  ctx: ResolveContext
): Promise<PlatformState> {
  if (isMemoryPlatformPersistence()) {
    let state = getPlatformState();
    state = ensureSystemTemplates(state);
    state = bootstrapCoreInstallations(state, ctx);
    ensureBetaActive(ctx.userId);
    setPlatformState(state);
    return state;
  }

  try {
    const supabase: AnyClient = await createClient();
    try {
      await supabase.rpc("ensure_beta_active_for_user", { p_user_id: ctx.userId });
    } catch {
      /* function may not exist until migration applied */
    }

    let capQuery = supabase
      .from("aura_capability_installations")
      .select("*")
      .eq("user_id", ctx.userId)
      .eq("soft_deleted", false);
    capQuery = ctx.workspaceId
      ? capQuery.eq("workspace_id", ctx.workspaceId)
      : capQuery.is("workspace_id", null);
    const { data: capData } = await capQuery;

    let skillQuery = supabase
      .from("aura_skill_installations")
      .select("*")
      .eq("user_id", ctx.userId)
      .eq("soft_deleted", false);
    skillQuery = ctx.workspaceId
      ? skillQuery.eq("workspace_id", ctx.workspaceId)
      : skillQuery.is("workspace_id", null);
    const { data: skillData } = await skillQuery;

    const { data: flagData } = await supabase
      .from("aura_feature_flags")
      .select("*")
      .or(`user_id.eq.${ctx.userId},scope.eq.system`);

    const { data: onboardingData } = await supabase
      .from("aura_onboarding_progress")
      .select("*")
      .eq("user_id", ctx.userId)
      .maybeSingle();

    let navQuery = supabase
      .from("aura_navigation_prefs")
      .select("*")
      .eq("user_id", ctx.userId);
    navQuery = ctx.workspaceId
      ? navQuery.eq("workspace_id", ctx.workspaceId)
      : navQuery.is("workspace_id", null);
    const { data: navData } = await navQuery.maybeSingle();

    let state = createEmptyPlatformState();
    state = ensureSystemTemplates(state);

    state = {
      ...state,
      installations: ((capData as Record<string, unknown>[]) ?? []).map(mapCap),
      skillInstallations: ((skillData as Record<string, unknown>[]) ?? []).map(mapSkill),
      featureFlags: ((flagData as Record<string, unknown>[]) ?? []).map(
        (r): FeatureFlag => ({
          id: String(r.id),
          key: String(r.key),
          scope: r.scope as FeatureFlag["scope"],
          enabled: Boolean(r.enabled),
          userId: (r.user_id as string | null) ?? null,
          workspaceId: (r.workspace_id as string | null) ?? null,
          capabilityId: (r.capability_id as string | null) ?? null,
          environment: (r.environment as string | null) ?? null,
          reason: String(r.reason ?? ""),
          updatedAt: String(r.updated_at),
        })
      ),
    };

    if (onboardingData) {
      const ob = onboardingData as Record<string, unknown>;
      state = {
        ...state,
        onboardingByUser: {
          [ctx.userId]: {
            completed: Boolean(ob.completed),
            answers: (ob.answers as never) ?? null,
            experienceMode: (ob.experience_mode as never) ?? "CUSTOM",
          },
        },
      };
    }

    if (navData) {
      const nav = navData as Record<string, unknown>;
      state = {
        ...state,
        navigationOrderByUser: {
          [ctx.userId]: (nav.order_ids as string[]) ?? [],
        },
      };
    }

    state = bootstrapCoreInstallations(state, ctx);
    setPlatformState(state);
    ensureBetaActive(ctx.userId);
    return state;
  } catch (err) {
    recordPlatformEvent({
      event: "platform_error",
      userId: ctx.userId,
      errorCode: "load_failed",
      result: "error",
      metadata: {
        message: err instanceof Error ? err.message.slice(0, 120) : "unknown",
      },
    });
    let state = getPlatformState();
    state = ensureSystemTemplates(state);
    state = bootstrapCoreInstallations(state, ctx);
    setPlatformState(state);
    return state;
  }
}

export async function persistPlatformState(
  state: PlatformState,
  ctx: ResolveContext
): Promise<{ ok: boolean; error?: string }> {
  setPlatformState(state);
  if (isMemoryPlatformPersistence()) {
    return { ok: true };
  }

  try {
    const supabase: AnyClient = await createClient();

    const caps = state.installations.filter(
      (i) => i.userId === ctx.userId && i.workspaceId === ctx.workspaceId
    );
    if (caps.length) {
      await supabase.from("aura_capability_installations").upsert(
        caps.map((i) => ({
          id: i.id,
          capability_id: i.capabilityId,
          user_id: i.userId,
          workspace_id: i.workspaceId,
          status: i.status,
          installed_version: i.installedVersion,
          enabled: i.enabled,
          config: i.config,
          error_message: i.errorMessage,
          installed_at: i.installedAt,
          enabled_at: i.enabledAt,
          disabled_at: i.disabledAt,
          updated_at: i.updatedAt,
          soft_deleted: i.softDeleted,
        })),
        { onConflict: "capability_id,user_id,workspace_id" }
      );
    }

    const skills = state.skillInstallations.filter(
      (i) => i.userId === ctx.userId && i.workspaceId === ctx.workspaceId
    );
    if (skills.length) {
      await supabase.from("aura_skill_installations").upsert(
        skills.map((i) => ({
          id: i.id,
          skill_id: i.skillId,
          user_id: i.userId,
          workspace_id: i.workspaceId,
          status: i.status,
          installed_version: i.installedVersion,
          enabled: i.enabled,
          config: i.config,
          error_message: i.errorMessage,
          installed_at: i.installedAt,
          enabled_at: i.enabledAt,
          disabled_at: i.disabledAt,
          updated_at: i.updatedAt,
          soft_deleted: i.softDeleted,
        })),
        { onConflict: "skill_id,user_id,workspace_id" }
      );
    }

    const onboarding = state.onboardingByUser[ctx.userId];
    if (onboarding) {
      await supabase.from("aura_onboarding_progress").upsert(
        {
          id: `onb_${ctx.userId}`,
          user_id: ctx.userId,
          workspace_id: ctx.workspaceId,
          step: onboarding.completed ? 10 : 2,
          completed: onboarding.completed,
          answers: onboarding.answers ?? {},
          experience_mode: onboarding.experienceMode,
          first_value_checklist: {},
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" }
      );
    }

    const order = state.navigationOrderByUser[ctx.userId];
    if (order) {
      await supabase.from("aura_navigation_prefs").upsert(
        {
          id: `nav_${ctx.userId}_${ctx.workspaceId ?? "personal"}`,
          user_id: ctx.userId,
          workspace_id: ctx.workspaceId,
          order_ids: order,
          hidden_ids: [],
          favorite_ids: [],
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,workspace_id" }
      );
    }

    return { ok: true };
  } catch (err) {
    recordPlatformEvent({
      event: "platform_error",
      userId: ctx.userId,
      errorCode: "persist_failed",
      result: "error",
      metadata: {
        message: err instanceof Error ? err.message.slice(0, 120) : "unknown",
      },
    });
    return {
      ok: false,
      error: err instanceof Error ? err.message : "persist_failed",
    };
  }
}

export async function resolveViewerContext(): Promise<ResolveContext> {
  const ctx = await getDataContext();
  let workspaceSlug: string | null = null;
  if (ctx.activeWorkspaceId) {
    try {
      const supabase = await createClient();
      const { data } = await supabase
        .from("workspaces")
        .select("slug")
        .eq("id", ctx.activeWorkspaceId)
        .maybeSingle();
      workspaceSlug = data?.slug ?? null;
    } catch {
      workspaceSlug = null;
    }
  }
  return {
    userId: ctx.userId,
    workspaceId: ctx.activeWorkspaceId,
    workspaceSlug,
    role: ctx.workspaceRole ?? "owner",
    isWorkspaceMember: Boolean(ctx.activeWorkspaceId && ctx.workspaceRole),
    environment: process.env.NODE_ENV,
  };
}
