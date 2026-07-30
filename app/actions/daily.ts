"use server";

import { revalidatePath } from "next/cache";
import {
  addComment,
  editComment,
  listActivities,
  listBrainNotifications,
  listComments,
  listFavorites,
  listFeed,
  listInboxItems,
  markBrainNotificationRead,
  quickCapture,
  toggleFavorite,
  updateInboxItem,
} from "@/lib/supabase/services/daily-ops.service";
import type {
  CommentTargetType,
  FavoriteTargetType,
  InboxStatus,
  QuickCaptureInput,
} from "@/lib/daily/types";

function revalidateDaily(): void {
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/inbox");
  revalidatePath("/dashboard/feed");
  revalidatePath("/dashboard/favorites");
  revalidatePath("/dashboard/discovery");
  revalidatePath("/dashboard/settings/memory");
}

export async function quickCaptureAction(input: QuickCaptureInput) {
  const res = await quickCapture(input);
  revalidateDaily();
  return res;
}

export async function toggleFavoriteAction(input: {
  targetType: FavoriteTargetType;
  targetId: string;
  title: string;
  href: string;
}) {
  const res = await toggleFavorite(input);
  revalidateDaily();
  return res;
}

export async function listFavoritesAction() {
  return listFavorites();
}

export async function addCommentAction(input: {
  targetType: CommentTargetType;
  targetId: string;
  body: string;
  shareWithWorkspace?: boolean;
}) {
  const res = await addComment(input);
  revalidateDaily();
  return res;
}

export async function editCommentAction(input: {
  commentId: string;
  body: string;
}) {
  const res = await editComment(input);
  revalidateDaily();
  return res;
}

export async function listCommentsAction(
  targetType: CommentTargetType,
  targetId: string
) {
  return listComments(targetType, targetId);
}

export async function listInboxAction(
  filter?: "unclassified" | "pending_review" | "recent" | "all"
) {
  return listInboxItems(filter);
}

export async function updateInboxAction(input: {
  memoryId: string;
  status: InboxStatus;
  tags?: string[];
}) {
  const res = await updateInboxItem(input);
  revalidateDaily();
  return res;
}

export async function listFeedAction(limit?: number) {
  return listFeed(limit);
}

export async function listActivitiesAction(limit?: number) {
  return listActivities(limit);
}

export async function listBrainNotificationsAction(unreadOnly?: boolean) {
  return listBrainNotifications(unreadOnly);
}

export async function markBrainNotificationReadAction(id: string) {
  await markBrainNotificationRead(id);
  revalidatePath("/dashboard");
}
