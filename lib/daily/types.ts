/**
 * RC3 Daily Operations — contracts.
 * No Decision Support / Execution. executionInfluence remains none upstream.
 */

import type { VisibilityScope } from "@/lib/aura-brain/visibility";

export type FavoriteTargetType =
  | "memory"
  | "entity"
  | "project"
  | "discovery"
  | "document";

export type CommentTargetType =
  | "memory"
  | "discovery"
  | "insight"
  | "entity"
  | "project"
  | "document";

export type FavoritePinSurface = "home" | "search" | "feed";

export type DailyFavorite = {
  id: string;
  userId: string;
  workspaceId: string | null;
  targetType: FavoriteTargetType;
  targetId: string;
  title: string;
  href: string;
  /** RC3.1 — optional pins for Home / Search / Feed */
  pins?: FavoritePinSurface[];
  createdAt: string;
};

export type DailyComment = {
  id: string;
  userId: string;
  workspaceId: string | null;
  targetType: CommentTargetType;
  targetId: string;
  body: string;
  visibilityScope: VisibilityScope;
  editedAt: string | null;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type DailyCommentHistory = {
  id: string;
  commentId: string;
  userId: string;
  previousBody: string;
  createdAt: string;
};

export type DailyActivityType =
  | "memory_created"
  | "memory_archived"
  | "memory_confirmed"
  | "discovery_generated"
  | "discovery_confirmed"
  | "discovery_rejected"
  | "discovery_archived"
  | "feedback"
  | "comment"
  | "favorite"
  | "inbox_classified";

export type DailyActivity = {
  id: string;
  userId: string;
  workspaceId: string | null;
  actorUserId: string;
  activityType: DailyActivityType;
  title: string;
  summary: string;
  targetType: string | null;
  targetId: string | null;
  href: string | null;
  visibilityScope: VisibilityScope;
  metadata: Record<string, unknown>;
  createdAt: string;
};

export type BrainNotificationKind =
  | "new_discovery"
  | "new_comment"
  | "feedback_received"
  | "shared_memory";

export type BrainNotification = {
  id: string;
  userId: string;
  workspaceId: string | null;
  kind: BrainNotificationKind;
  title: string;
  message: string;
  href: string | null;
  relatedType: string | null;
  relatedId: string | null;
  readAt: string | null;
  createdAt: string;
};

export type InboxStatus = "unclassified" | "pending_review" | "classified" | "archived";

export type InboxItem = {
  memoryId: string;
  userId: string;
  workspaceId: string | null;
  title: string;
  summary: string;
  tags: string[];
  status: InboxStatus;
  visibilityScope: VisibilityScope;
  createdAt: string;
  updatedAt: string;
};

export type FeedItemKind =
  | "memory"
  | "discovery"
  | "feedback"
  | "comment"
  | "archive"
  | "confirm";

export type FeedItem = {
  id: string;
  kind: FeedItemKind;
  title: string;
  summary: string;
  actorUserId: string;
  workspaceId: string | null;
  href: string;
  createdAt: string;
};

export type QuickCaptureAttachmentMeta = {
  kind: "image" | "pdf" | "audio" | "link" | "video_link" | "file";
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  url?: string;
  storagePath?: string;
  ocrText?: string;
  linkPreview?: {
    url: string;
    title: string | null;
    description: string | null;
    favicon: string | null;
    image: string | null;
    fetchedAt: string;
  };
};

export type QuickCaptureInput = {
  title?: string;
  description: string;
  /** Legacy URL list — still supported */
  attachments?: string[];
  /** RC3.1 rich attachments */
  richAttachments?: QuickCaptureAttachmentMeta[];
  links?: string[];
  tags?: string[];
  suggestedTags?: string[];
  ocrText?: string;
  visibility?: VisibilityScope;
  workspaceId?: string | null;
  shareWithWorkspace?: boolean;
  pinTo?: FavoritePinSurface[];
  source?: "quick_capture" | "share" | "drag_drop" | "offline_sync";
};

export type CascadeReport = {
  memoryId: string;
  promotionOk: boolean;
  worldOk: boolean;
  cognitiveOk: boolean;
  discoveryOk: boolean;
  discoveryGenerated: number;
  errors: string[];
  durationMs: number;
  executionInfluence: "none";
};

export type DailyOpsState = {
  favorites: DailyFavorite[];
  comments: DailyComment[];
  commentHistory: DailyCommentHistory[];
  activities: DailyActivity[];
  notifications: BrainNotification[];
  inbox: InboxItem[];
};

export function createEmptyDailyOpsState(): DailyOpsState {
  return {
    favorites: [],
    comments: [],
    commentHistory: [],
    activities: [],
    notifications: [],
    inbox: [],
  };
}

export function newDailyId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}
