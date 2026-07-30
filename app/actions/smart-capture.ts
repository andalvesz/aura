"use server";

import { revalidatePath } from "next/cache";
import {
  listMemoryAttachments,
  searchMemoryAttachments,
  smartCapture,
  suggestCaptureTags,
} from "@/lib/supabase/services/smart-capture.service";
import type { SmartCaptureInput } from "@/lib/smart-capture/types";
import { updateFavoritePinsPure } from "@/lib/daily/engine";
import {
  getDailyOpsState,
  setDailyOpsState,
  dailyOpsKey,
} from "@/lib/daily/store";
import { getDataContext } from "@/lib/supabase/services/context";
import type { FavoritePinSurface, FavoriteTargetType } from "@/lib/daily/types";

function revalidateCapture(): void {
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/inbox");
  revalidatePath("/dashboard/feed");
  revalidatePath("/dashboard/favorites");
  revalidatePath("/dashboard/discovery");
  revalidatePath("/dashboard/settings/memory");
  revalidatePath("/dashboard/settings/sync");
  revalidatePath("/dashboard/attachments");
}

export async function smartCaptureAction(input: SmartCaptureInput) {
  const res = await smartCapture(input);
  revalidateCapture();
  return res;
}

export async function suggestTagsAction(input: {
  title?: string;
  description?: string;
  ocrText?: string;
  links?: string[];
  fileNames?: string[];
  existingTags?: string[];
}) {
  return suggestCaptureTags(input);
}

export async function listAttachmentsAction() {
  return listMemoryAttachments();
}

export async function searchAttachmentsAction(query: string) {
  return searchMemoryAttachments(query);
}

export async function updateFavoritePinsAction(input: {
  targetType: FavoriteTargetType;
  targetId: string;
  pins: FavoritePinSurface[];
}) {
  const ctx = await getDataContext();
  const key = dailyOpsKey(ctx.userId, ctx.activeWorkspaceId ?? null);
  const res = updateFavoritePinsPure(getDailyOpsState(key), {
    userId: ctx.userId,
    ...input,
  });
  if (res.error) return { favorite: null, error: res.error };
  setDailyOpsState(key, res.state);
  revalidateCapture();
  return { favorite: res.favorite, error: null };
}
