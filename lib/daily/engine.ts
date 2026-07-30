/**
 * Daily Ops pure engine — favorites, comments, activity, inbox, notifications, feed.
 */

import { canViewerAccess, resolveVisibilityScope } from "@/lib/aura-brain/visibility";
import type { VisibilityScope } from "@/lib/aura-brain/visibility";
import {
  newDailyId,
  type BrainNotification,
  type BrainNotificationKind,
  type CommentTargetType,
  type DailyActivity,
  type DailyActivityType,
  type DailyComment,
  type DailyFavorite,
  type DailyOpsState,
  type FavoriteTargetType,
  type FeedItem,
  type InboxItem,
  type InboxStatus,
} from "@/lib/daily/types";

export function toggleFavoritePure(
  state: DailyOpsState,
  input: {
    userId: string;
    workspaceId?: string | null;
    targetType: FavoriteTargetType;
    targetId: string;
    title: string;
    href: string;
    pins?: DailyFavorite["pins"];
  }
): { state: DailyOpsState; favorite: DailyFavorite | null; removed: boolean } {
  const existing = state.favorites.find(
    (f) =>
      f.userId === input.userId &&
      f.targetType === input.targetType &&
      f.targetId === input.targetId
  );
  if (existing) {
    return {
      state: {
        ...state,
        favorites: state.favorites.filter((f) => f.id !== existing.id),
      },
      favorite: null,
      removed: true,
    };
  }
  const favorite: DailyFavorite = {
    id: newDailyId("fav"),
    userId: input.userId,
    workspaceId: input.workspaceId ?? null,
    targetType: input.targetType,
    targetId: input.targetId,
    title: input.title,
    href: input.href,
    pins: input.pins ?? [],
    createdAt: new Date().toISOString(),
  };
  return {
    state: { ...state, favorites: [favorite, ...state.favorites] },
    favorite,
    removed: false,
  };
}

export function updateFavoritePinsPure(
  state: DailyOpsState,
  input: {
    userId: string;
    targetType: FavoriteTargetType;
    targetId: string;
    pins: NonNullable<DailyFavorite["pins"]>;
  }
): { state: DailyOpsState; favorite: DailyFavorite | null; error: string | null } {
  const idx = state.favorites.findIndex(
    (f) =>
      f.userId === input.userId &&
      f.targetType === input.targetType &&
      f.targetId === input.targetId
  );
  if (idx < 0) {
    return { state, favorite: null, error: "Favorito não encontrado" };
  }
  const favorites = [...state.favorites];
  favorites[idx] = { ...favorites[idx], pins: input.pins };
  return { state: { ...state, favorites }, favorite: favorites[idx], error: null };
}

export function listFavoritesPure(
  state: DailyOpsState,
  userId: string
): DailyFavorite[] {
  return state.favorites.filter((f) => f.userId === userId);
}

export function addCommentPure(
  state: DailyOpsState,
  input: {
    userId: string;
    workspaceId?: string | null;
    targetType: CommentTargetType;
    targetId: string;
    body: string;
    visibilityScope?: VisibilityScope;
  }
): { state: DailyOpsState; comment: DailyComment } {
  const now = new Date().toISOString();
  const comment: DailyComment = {
    id: newDailyId("cmt"),
    userId: input.userId,
    workspaceId: input.workspaceId ?? null,
    targetType: input.targetType,
    targetId: input.targetId,
    body: input.body.trim(),
    visibilityScope: resolveVisibilityScope(
      input.visibilityScope,
      input.workspaceId ? "WORKSPACE" : "PRIVATE"
    ),
    editedAt: null,
    deletedAt: null,
    createdAt: now,
    updatedAt: now,
  };
  return {
    state: { ...state, comments: [comment, ...state.comments] },
    comment,
  };
}

export function editCommentPure(
  state: DailyOpsState,
  input: { userId: string; commentId: string; body: string }
): { state: DailyOpsState; comment: DailyComment | null; error: string | null } {
  const comment = state.comments.find((c) => c.id === input.commentId);
  if (!comment || comment.deletedAt) {
    return { state, comment: null, error: "Comentário não encontrado" };
  }
  if (comment.userId !== input.userId) {
    return { state, comment: null, error: "Sem permissão para editar" };
  }
  const now = new Date().toISOString();
  const history = {
    id: newDailyId("cmh"),
    commentId: comment.id,
    userId: input.userId,
    previousBody: comment.body,
    createdAt: now,
  };
  const updated: DailyComment = {
    ...comment,
    body: input.body.trim(),
    editedAt: now,
    updatedAt: now,
  };
  return {
    state: {
      ...state,
      comments: state.comments.map((c) => (c.id === comment.id ? updated : c)),
      commentHistory: [history, ...state.commentHistory],
    },
    comment: updated,
    error: null,
  };
}

export function listCommentsPure(
  state: DailyOpsState,
  viewer: {
    userId: string;
    workspaceId?: string | null;
    isWorkspaceMember?: boolean;
  },
  targetType: CommentTargetType,
  targetId: string
): DailyComment[] {
  return state.comments.filter((c) => {
    if (c.deletedAt) return false;
    if (c.targetType !== targetType || c.targetId !== targetId) return false;
    return canViewerAccess({
      viewerUserId: viewer.userId,
      ownerUserId: c.userId,
      visibilityScope: c.visibilityScope,
      workspaceId: c.workspaceId,
      viewerWorkspaceId: viewer.workspaceId ?? null,
      isWorkspaceMember: viewer.isWorkspaceMember,
    });
  });
}

export function recordActivityPure(
  state: DailyOpsState,
  input: {
    userId: string;
    actorUserId: string;
    workspaceId?: string | null;
    activityType: DailyActivityType;
    title: string;
    summary?: string;
    targetType?: string | null;
    targetId?: string | null;
    href?: string | null;
    visibilityScope?: VisibilityScope;
    metadata?: Record<string, unknown>;
  }
): { state: DailyOpsState; activity: DailyActivity } {
  const activity: DailyActivity = {
    id: newDailyId("act"),
    userId: input.userId,
    workspaceId: input.workspaceId ?? null,
    actorUserId: input.actorUserId,
    activityType: input.activityType,
    title: input.title,
    summary: input.summary ?? "",
    targetType: input.targetType ?? null,
    targetId: input.targetId ?? null,
    href: input.href ?? null,
    visibilityScope: resolveVisibilityScope(
      input.visibilityScope,
      input.workspaceId ? "WORKSPACE" : "PRIVATE"
    ),
    metadata: input.metadata ?? {},
    createdAt: new Date().toISOString(),
  };
  return {
    state: {
      ...state,
      activities: [activity, ...state.activities].slice(0, 500),
    },
    activity,
  };
}

export function listActivitiesPure(
  state: DailyOpsState,
  viewer: {
    userId: string;
    workspaceId?: string | null;
    isWorkspaceMember?: boolean;
  },
  limit = 40
): DailyActivity[] {
  return state.activities
    .filter((a) =>
      canViewerAccess({
        viewerUserId: viewer.userId,
        ownerUserId: a.userId,
        visibilityScope: a.visibilityScope,
        workspaceId: a.workspaceId,
        viewerWorkspaceId: viewer.workspaceId ?? null,
        isWorkspaceMember: viewer.isWorkspaceMember,
      })
    )
    .slice(0, limit);
}

export function pushNotificationPure(
  state: DailyOpsState,
  input: {
    userId: string;
    workspaceId?: string | null;
    kind: BrainNotificationKind;
    title: string;
    message?: string;
    href?: string | null;
    relatedType?: string | null;
    relatedId?: string | null;
  }
): { state: DailyOpsState; notification: BrainNotification } {
  const notification: BrainNotification = {
    id: newDailyId("bnt"),
    userId: input.userId,
    workspaceId: input.workspaceId ?? null,
    kind: input.kind,
    title: input.title,
    message: input.message ?? "",
    href: input.href ?? null,
    relatedType: input.relatedType ?? null,
    relatedId: input.relatedId ?? null,
    readAt: null,
    createdAt: new Date().toISOString(),
  };
  return {
    state: {
      ...state,
      notifications: [notification, ...state.notifications].slice(0, 200),
    },
    notification,
  };
}

export function listNotificationsPure(
  state: DailyOpsState,
  userId: string,
  unreadOnly = false
): BrainNotification[] {
  return state.notifications.filter(
    (n) => n.userId === userId && (!unreadOnly || !n.readAt)
  );
}

export function markNotificationReadPure(
  state: DailyOpsState,
  userId: string,
  notificationId: string
): DailyOpsState {
  return {
    ...state,
    notifications: state.notifications.map((n) =>
      n.id === notificationId && n.userId === userId
        ? { ...n, readAt: new Date().toISOString() }
        : n
    ),
  };
}

export function upsertInboxItemPure(
  state: DailyOpsState,
  item: InboxItem
): DailyOpsState {
  const without = state.inbox.filter((i) => i.memoryId !== item.memoryId);
  return { ...state, inbox: [item, ...without] };
}

export function updateInboxStatusPure(
  state: DailyOpsState,
  userId: string,
  memoryId: string,
  status: InboxStatus,
  tags?: string[]
): { state: DailyOpsState; item: InboxItem | null; error: string | null } {
  const item = state.inbox.find(
    (i) => i.memoryId === memoryId && i.userId === userId
  );
  if (!item) return { state, item: null, error: "Item não encontrado na Inbox" };
  const updated: InboxItem = {
    ...item,
    status,
    tags: tags ?? item.tags,
    updatedAt: new Date().toISOString(),
  };
  return {
    state: {
      ...state,
      inbox: state.inbox.map((i) =>
        i.memoryId === memoryId ? updated : i
      ),
    },
    item: updated,
    error: null,
  };
}

export function listInboxPure(
  state: DailyOpsState,
  userId: string,
  filter?: "unclassified" | "pending_review" | "recent" | "all"
): InboxItem[] {
  let items = state.inbox.filter((i) => i.userId === userId);
  if (filter === "unclassified") {
    items = items.filter((i) => i.status === "unclassified");
  } else if (filter === "pending_review") {
    items = items.filter((i) => i.status === "pending_review");
  } else if (filter === "recent") {
    const week = Date.now() - 7 * 24 * 60 * 60 * 1000;
    items = items.filter((i) => new Date(i.createdAt).getTime() >= week);
  } else {
    items = items.filter((i) => i.status !== "archived");
  }
  return items.sort(
    (a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

export function buildFeedPure(
  activities: DailyActivity[],
  viewer: {
    userId: string;
    workspaceId?: string | null;
    isWorkspaceMember?: boolean;
  },
  limit = 50
): FeedItem[] {
  const kindMap: Partial<Record<DailyActivityType, FeedItem["kind"]>> = {
    memory_created: "memory",
    discovery_generated: "discovery",
    feedback: "feedback",
    comment: "comment",
    memory_archived: "archive",
    discovery_archived: "archive",
    discovery_confirmed: "confirm",
    memory_confirmed: "confirm",
  };

  return listActivitiesPure(
    { favorites: [], comments: [], commentHistory: [], activities, notifications: [], inbox: [] },
    viewer,
    limit
  )
    .map((a) => {
      const kind = kindMap[a.activityType];
      if (!kind) return null;
      return {
        id: a.id,
        kind,
        title: a.title,
        summary: a.summary,
        actorUserId: a.actorUserId,
        workspaceId: a.workspaceId,
        href: a.href ?? "/dashboard",
        createdAt: a.createdAt,
      } satisfies FeedItem;
    })
    .filter((x): x is FeedItem => Boolean(x));
}

export function filterTimelineByPeriod<T extends { createdAt?: string; at?: string; occurredAt?: string }>(
  items: T[],
  period: "today" | "week" | "month" | "all"
): T[] {
  if (period === "all") return items;
  const now = new Date();
  const start = new Date(now);
  if (period === "today") start.setHours(0, 0, 0, 0);
  else if (period === "week") start.setDate(start.getDate() - 7);
  else start.setMonth(start.getMonth() - 1);

  return items.filter((item) => {
    const raw = item.createdAt ?? item.at ?? item.occurredAt;
    if (!raw) return false;
    return new Date(raw).getTime() >= start.getTime();
  });
}
