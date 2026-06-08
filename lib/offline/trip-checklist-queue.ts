import { OFFLINE_STORAGE_PREFIX } from "@/lib/offline/constants";
import { createClient } from "@/lib/supabase/client";
import { resolveChecklistSeed } from "@/utils/travel";

const QUEUE_KEY = `${OFFLINE_STORAGE_PREFIX}:trip-checklist-seeds`;

export type PendingTripChecklistSeed = {
  tripId: string;
  templateId: string | null;
  createdAt: string;
};

function readQueue(): PendingTripChecklistSeed[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as PendingTripChecklistSeed[];
  } catch {
    return [];
  }
}

function writeQueue(queue: PendingTripChecklistSeed[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  } catch {
    /* quota */
  }
}

export function queueTripChecklistSeed(
  tripId: string,
  templateId: string | null | undefined
): void {
  const queue = readQueue();
  if (queue.some((item) => item.tripId === tripId)) return;
  queue.push({
    tripId,
    templateId: templateId ?? null,
    createdAt: new Date().toISOString(),
  });
  writeQueue(queue);
}

async function seedChecklistForTrip(
  tripId: string,
  templateId: string | null,
  userId: string
): Promise<string | null> {
  const supabase = createClient();
  const items = resolveChecklistSeed(templateId);

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const { error } = await supabase.from("trip_checklist_items").insert({
      user_id: userId,
      trip_id: tripId,
      categoria: item.categoria,
      titulo: item.titulo,
      status: "pendente",
      ordem: i,
    });
    if (error) return error.message;
  }

  return null;
}

export async function flushTripChecklistSeeds(): Promise<{
  flushed: number;
  failed: number;
}> {
  if (typeof window === "undefined" || !navigator.onLine) {
    return { flushed: 0, failed: 0 };
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { flushed: 0, failed: 0 };

  const queue = readQueue();
  if (!queue.length) return { flushed: 0, failed: 0 };

  const remaining: PendingTripChecklistSeed[] = [];
  let flushed = 0;
  let failed = 0;

  for (const item of queue) {
    const error = await seedChecklistForTrip(item.tripId, item.templateId, user.id);
    if (error) {
      remaining.push(item);
      failed += 1;
    } else {
      flushed += 1;
    }
  }

  writeQueue(remaining);
  return { flushed, failed };
}

export function getPendingTripChecklistSeedCount(): number {
  return readQueue().length;
}
