/**
 * Daily Ops service facade (RC3).
 */

import {
  addCommentPure,
  buildFeedPure,
  editCommentPure,
  listActivitiesPure,
  listCommentsPure,
  listFavoritesPure,
  listInboxPure,
  listNotificationsPure,
  markNotificationReadPure,
  pushNotificationPure,
  recordActivityPure,
  toggleFavoritePure,
  updateInboxStatusPure,
  upsertInboxItemPure,
} from "@/lib/daily/engine";
import { runQuickCaptureCascade } from "@/lib/daily/cascade";
import {
  dailyOpsKey,
  getDailyOpsState,
  setDailyOpsState,
} from "@/lib/daily/store";
import type {
  CascadeReport,
  CommentTargetType,
  DailyActivity,
  DailyComment,
  DailyFavorite,
  FavoriteTargetType,
  FeedItem,
  InboxItem,
  InboxStatus,
  BrainNotification,
  QuickCaptureInput,
} from "@/lib/daily/types";
import { newDailyId } from "@/lib/daily/types";
import {
  resolveCreateVisibility,
  resolveVisibilityScope,
  mapVisibilityToConsent,
} from "@/lib/aura-brain/visibility";
import { getDataContext } from "@/lib/supabase/services/context";
import {
  createMemory,
  promoteMemory,
  submitMemoryFeedback,
  archiveMemory,
  listMemories,
} from "@/lib/supabase/services/memory-engine.service";
import { projectMemoryToWorldModel } from "@/lib/supabase/services/world-model.service";
import { generateCognitiveArtifacts } from "@/lib/supabase/services/cognitive-engine.service";
import { generateDiscoveries } from "@/lib/supabase/services/discovery-engine.service";
import type { CreateMemoryInput } from "@/lib/memory/types";

function keyFromCtx(userId: string, workspaceId: string | null): string {
  return dailyOpsKey(userId, workspaceId);
}

export async function toggleFavorite(input: {
  targetType: FavoriteTargetType;
  targetId: string;
  title: string;
  href: string;
  pins?: import("@/lib/daily/types").FavoritePinSurface[];
}): Promise<{ favorite: DailyFavorite | null; removed: boolean; error: string | null }> {
  const ctx = await getDataContext();
  const ws = ctx.activeWorkspaceId ?? null;
  const key = keyFromCtx(ctx.userId, ws);
  const state = getDailyOpsState(key);
  const res = toggleFavoritePure(state, {
    userId: ctx.userId,
    workspaceId: ws,
    ...input,
  });
  setDailyOpsState(key, res.state);
  if (!res.removed && res.favorite) {
    const withAct = recordActivityPure(res.state, {
      userId: ctx.userId,
      actorUserId: ctx.userId,
      workspaceId: ws,
      activityType: "favorite",
      title: `Favoritou: ${input.title}`,
      targetType: input.targetType,
      targetId: input.targetId,
      href: input.href,
      visibilityScope: "PRIVATE",
    });
    setDailyOpsState(key, withAct.state);
  }
  return { favorite: res.favorite, removed: res.removed, error: null };
}

export async function listFavorites(): Promise<DailyFavorite[]> {
  const ctx = await getDataContext();
  const key = keyFromCtx(ctx.userId, ctx.activeWorkspaceId ?? null);
  return listFavoritesPure(getDailyOpsState(key), ctx.userId);
}

export async function addComment(input: {
  targetType: CommentTargetType;
  targetId: string;
  body: string;
  shareWithWorkspace?: boolean;
}): Promise<{ comment: DailyComment | null; error: string | null }> {
  if (!input.body?.trim()) return { comment: null, error: "Comentário vazio" };
  const ctx = await getDataContext();
  const ws = ctx.activeWorkspaceId ?? null;
  const key = keyFromCtx(ctx.userId, ws);
  const visibility = resolveCreateVisibility({
    kind: "feedback",
    activeContext: ctx.activeContext,
    workspaceId: ws,
    shareWithWorkspace: input.shareWithWorkspace,
  });
  let state = getDailyOpsState(key);
  const res = addCommentPure(state, {
    userId: ctx.userId,
    workspaceId: ws,
    targetType: input.targetType,
    targetId: input.targetId,
    body: input.body,
    visibilityScope: visibility,
  });
  state = res.state;
  const act = recordActivityPure(state, {
    userId: ctx.userId,
    actorUserId: ctx.userId,
    workspaceId: ws,
    activityType: "comment",
    title: "Novo comentário",
    summary: input.body.slice(0, 120),
    targetType: input.targetType,
    targetId: input.targetId,
    href: hrefForTarget(input.targetType, input.targetId),
    visibilityScope: visibility,
  });
  state = act.state;
  const note = pushNotificationPure(state, {
    userId: ctx.userId,
    workspaceId: ws,
    kind: "new_comment",
    title: "Comentário registrado",
    message: input.body.slice(0, 160),
    href: hrefForTarget(input.targetType, input.targetId),
    relatedType: input.targetType,
    relatedId: input.targetId,
  });
  setDailyOpsState(key, note.state);
  return { comment: res.comment, error: null };
}

export async function editComment(input: {
  commentId: string;
  body: string;
}): Promise<{ comment: DailyComment | null; error: string | null }> {
  const ctx = await getDataContext();
  const key = keyFromCtx(ctx.userId, ctx.activeWorkspaceId ?? null);
  const res = editCommentPure(getDailyOpsState(key), {
    userId: ctx.userId,
    commentId: input.commentId,
    body: input.body,
  });
  if (res.error) return { comment: null, error: res.error };
  setDailyOpsState(key, res.state);
  return { comment: res.comment, error: null };
}

export async function listComments(
  targetType: CommentTargetType,
  targetId: string
): Promise<DailyComment[]> {
  const ctx = await getDataContext();
  const ws = ctx.activeWorkspaceId ?? null;
  const key = keyFromCtx(ctx.userId, ws);
  return listCommentsPure(
    getDailyOpsState(key),
    {
      userId: ctx.userId,
      workspaceId: ws,
      isWorkspaceMember: Boolean(ws),
    },
    targetType,
    targetId
  );
}

export async function listActivities(limit = 40): Promise<DailyActivity[]> {
  const ctx = await getDataContext();
  const ws = ctx.activeWorkspaceId ?? null;
  const key = keyFromCtx(ctx.userId, ws);
  return listActivitiesPure(
    getDailyOpsState(key),
    {
      userId: ctx.userId,
      workspaceId: ws,
      isWorkspaceMember: Boolean(ws),
    },
    limit
  );
}

export async function listFeed(limit = 50): Promise<FeedItem[]> {
  const activities = await listActivities(limit * 2);
  const ctx = await getDataContext();
  return buildFeedPure(
    activities,
    {
      userId: ctx.userId,
      workspaceId: ctx.activeWorkspaceId ?? null,
      isWorkspaceMember: Boolean(ctx.activeWorkspaceId),
    },
    limit
  );
}

export async function listBrainNotifications(
  unreadOnly = false
): Promise<BrainNotification[]> {
  const ctx = await getDataContext();
  const key = keyFromCtx(ctx.userId, ctx.activeWorkspaceId ?? null);
  return listNotificationsPure(getDailyOpsState(key), ctx.userId, unreadOnly);
}

export async function markBrainNotificationRead(
  notificationId: string
): Promise<void> {
  const ctx = await getDataContext();
  const key = keyFromCtx(ctx.userId, ctx.activeWorkspaceId ?? null);
  setDailyOpsState(
    key,
    markNotificationReadPure(getDailyOpsState(key), ctx.userId, notificationId)
  );
}

export async function listInboxItems(
  filter?: "unclassified" | "pending_review" | "recent" | "all"
): Promise<InboxItem[]> {
  const ctx = await getDataContext();
  const key = keyFromCtx(ctx.userId, ctx.activeWorkspaceId ?? null);
  let items = listInboxPure(getDailyOpsState(key), ctx.userId, filter);
  if (items.length === 0) {
    // Hydrate from pending memories
    try {
      const mems = await listMemories({
        status: ["PENDING_REVIEW", "ACTIVE"],
        limit: 30,
      });
      let state = getDailyOpsState(key);
      for (const m of mems) {
        if (m.status === "PENDING_REVIEW" || m.metadata?.inbox === true) {
          state = upsertInboxItemPure(state, {
            memoryId: m.id,
            userId: m.userId,
            workspaceId: m.workspaceId,
            title: m.title,
            summary: m.content.slice(0, 200),
            tags: Array.isArray(m.metadata?.tags)
              ? (m.metadata.tags as string[])
              : [],
            status:
              m.status === "PENDING_REVIEW" ? "pending_review" : "unclassified",
            visibilityScope: resolveVisibilityScope(
              (m as { visibilityScope?: string }).visibilityScope ??
                (m.consentScope === "workspace" ? "WORKSPACE" : "PRIVATE")
            ),
            createdAt: m.createdAt,
            updatedAt: m.updatedAt,
          });
        }
      }
      setDailyOpsState(key, state);
      items = listInboxPure(state, ctx.userId, filter);
    } catch {
      /* ignore */
    }
  }
  return items;
}

export async function updateInboxItem(input: {
  memoryId: string;
  status: InboxStatus;
  tags?: string[];
}): Promise<{ error: string | null }> {
  const ctx = await getDataContext();
  const key = keyFromCtx(ctx.userId, ctx.activeWorkspaceId ?? null);
  const res = updateInboxStatusPure(
    getDailyOpsState(key),
    ctx.userId,
    input.memoryId,
    input.status,
    input.tags
  );
  if (res.error) return { error: res.error };
  setDailyOpsState(key, res.state);

  if (input.status === "classified") {
    await submitMemoryFeedback({
      memoryId: input.memoryId,
      kind: "accurate",
      note: "Classificado via Inbox",
    });
  }
  if (input.status === "archived") {
    await archiveMemory(input.memoryId);
  }
  return { error: null };
}

export async function quickCapture(
  input: QuickCaptureInput
): Promise<{
  memoryId: string | null;
  cascade: CascadeReport | null;
  error: string | null;
}> {
  if (!input.description?.trim()) {
    return { memoryId: null, cascade: null, error: "Descrição obrigatória" };
  }

  const ctx = await getDataContext();
  const ws =
    input.workspaceId !== undefined
      ? input.workspaceId
      : ctx.activeWorkspaceId ?? null;
  const visibility = resolveCreateVisibility({
    kind: "memory",
    explicit: input.visibility,
    activeContext: ctx.activeContext,
    workspaceId: ws,
    shareWithWorkspace:
      input.shareWithWorkspace ?? input.visibility === "WORKSPACE",
  });

  const title =
    input.title?.trim() ||
    input.description.trim().slice(0, 80) ||
    "Memória rápida";
  const tags = (input.tags ?? []).map((t) => t.trim()).filter(Boolean);
  const links = (input.links ?? []).map((l) => l.trim()).filter(Boolean);
  const attachments = (input.attachments ?? [])
    .map((a) => a.trim())
    .filter(Boolean);
  const richAttachments = input.richAttachments ?? [];
  const ocrText = input.ocrText?.trim() || null;

  const contentParts = [
    input.description.trim(),
    ocrText && !input.description.includes(ocrText)
      ? `\nOCR:\n${ocrText}`
      : "",
    links.length ? `\nLinks:\n${links.map((l) => `- ${l}`).join("\n")}` : "",
    attachments.length
      ? `\nAnexos:\n${attachments.map((a) => `- ${a}`).join("\n")}`
      : "",
    richAttachments.length
      ? `\nArquivos:\n${richAttachments.map((a) => `- ${a.fileName} (${a.kind})`).join("\n")}`
      : "",
    tags.length ? `\nTags: ${tags.join(", ")}` : "",
  ];

  const structuredContent: CreateMemoryInput["structuredContent"] = {
    kind: "episodic",
    when: new Date().toISOString(),
    summary: input.description.trim(),
  };

  const created = await createMemory({
    memoryType: "EPISODIC",
    title,
    content: contentParts.join(""),
    structuredContent,
    sourceType: "manual_entry",
    context: input.source ?? "quick_capture",
    workspaceId: ws,
    consentScope: mapVisibilityToConsent(visibility),
    confirmNow: false,
    retentionPolicy: "user_managed",
    sensitivity: "STANDARD",
    metadata: {
      inbox: true,
      tags,
      links,
      attachments,
      richAttachments,
      ocrText,
      suggestedTags: input.suggestedTags ?? [],
      visibilityScope: visibility,
      quickCapture: true,
      smartCapture: true,
      pinTo: input.pinTo ?? [],
      source: input.source ?? "quick_capture",
    },
    evidenceSummary: "Smart Capture RC3.1",
  });

  if (created.error || !created.memory) {
    return {
      memoryId: null,
      cascade: null,
      error: created.error ?? "Falha ao criar memória",
    };
  }

  const memory = created.memory;
  const key = keyFromCtx(ctx.userId, ws);
  let state = getDailyOpsState(key);
  state = upsertInboxItemPure(state, {
    memoryId: memory.id,
    userId: ctx.userId,
    workspaceId: ws,
    title: memory.title,
    summary: input.description.trim().slice(0, 200),
    tags,
    status: "unclassified",
    visibilityScope: visibility,
    createdAt: memory.createdAt,
    updatedAt: memory.updatedAt,
  });
  const act = recordActivityPure(state, {
    userId: ctx.userId,
    actorUserId: ctx.userId,
    workspaceId: ws,
    activityType: "memory_created",
    title: `Memória: ${memory.title}`,
    summary: input.description.trim().slice(0, 120),
    targetType: "memory",
    targetId: memory.id,
    href: `/dashboard/inbox?id=${memory.id}`,
    visibilityScope: visibility,
  });
  state = act.state;

  if (visibility === "WORKSPACE" && ws) {
    const note = pushNotificationPure(state, {
      userId: ctx.userId,
      workspaceId: ws,
      kind: "shared_memory",
      title: "Memória compartilhada",
      message: memory.title,
      href: `/dashboard/inbox?id=${memory.id}`,
      relatedType: "memory",
      relatedId: memory.id,
    });
    state = note.state;
  }
  setDailyOpsState(key, state);

  const cascade = await runQuickCaptureCascade(memory.id, {
    promoteMemory: async (id) => {
      const r = await promoteMemory(id);
      return { error: r.error };
    },
    projectMemoryToWorld: async (id) => {
      const r = await projectMemoryToWorldModel(id);
      return { error: r.error };
    },
    generateCognitive: async () => {
      const r = await generateCognitiveArtifacts({ maxArtifacts: 12 });
      return { error: r.error };
    },
    generateDiscoveries: async () => {
      const r = await generateDiscoveries({ maxArtifacts: 12 });
      return { error: r.error, generated: r.artifacts.length };
    },
  });

  if (cascade.discoveryGenerated > 0) {
    const s2 = pushNotificationPure(getDailyOpsState(key), {
      userId: ctx.userId,
      workspaceId: ws,
      kind: "new_discovery",
      title: "Novas descobertas",
      message: `${cascade.discoveryGenerated} sinal(is) após captura`,
      href: "/dashboard/discovery",
      relatedType: "discovery",
      relatedId: null,
    });
    setDailyOpsState(key, s2.state);
  }

  return { memoryId: memory.id, cascade, error: null };
}

function hrefForTarget(type: CommentTargetType, id: string): string {
  switch (type) {
    case "memory":
      return `/dashboard/settings/memory#${id}`;
    case "discovery":
      return `/dashboard/discovery?id=${id}`;
    case "insight":
      return `/dashboard/settings/insights`;
    case "entity":
      return `/dashboard/settings/world-model`;
    case "project":
      return `/dashboard/projects/${id}`;
    case "document":
      return `/dashboard/projects`;
    default:
      return "/dashboard";
  }
}

export { newDailyId };
