"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { smartCaptureAction } from "@/app/actions/smart-capture";
import {
  SMART_CAPTURE_SYNC_EVENT,
  emitSmartCaptureSyncEvent,
  getOfflineCaptureQueue,
  getSyncPanel,
  setLastSmartCaptureSync,
  setOfflineCaptureQueue,
  updateOfflineCaptureStatusPure,
} from "@/lib/smart-capture/offline-queue";
import type { SyncPanelSnapshot } from "@/lib/smart-capture/types";
import { useHasMounted } from "@/hooks/use-has-mounted";
import { useOnlineStatus } from "@/hooks/use-online-status";

async function resolveUserId(): Promise<string | null> {
  try {
    const supabase = createClient();
    const { data } = await supabase.auth.getUser();
    return data.user?.id ?? null;
  } catch {
    return null;
  }
}

export async function flushSmartCaptureQueue(
  userId?: string | null
): Promise<SyncPanelSnapshot | null> {
  const uid = userId ?? (await resolveUserId());
  if (!uid) return null;

  let items = getOfflineCaptureQueue(uid);
  const pending = items.filter(
    (i) => i.status === "pending" || i.status === "failed"
  );

  for (const item of pending) {
    items = updateOfflineCaptureStatusPure(items, item.id, "syncing");
    setOfflineCaptureQueue(uid, items);
    try {
      const res = await smartCaptureAction({
        ...item.payload,
        source: "offline_sync",
      });
      if (res.error) throw new Error(res.error);
      items = updateOfflineCaptureStatusPure(items, item.id, "sent");
    } catch (e) {
      items = updateOfflineCaptureStatusPure(
        items,
        item.id,
        "failed",
        e instanceof Error ? e.message : "sync failed"
      );
    }
    setOfflineCaptureQueue(uid, items);
  }

  const now = new Date().toISOString();
  setLastSmartCaptureSync(uid, now);
  emitSmartCaptureSyncEvent();
  return getSyncPanel(uid);
}

/** Syncs offline Smart Capture queue when back online. */
export function SmartCaptureOfflineSync() {
  const mounted = useHasMounted();
  const isOnline = useOnlineStatus();

  useEffect(() => {
    if (!mounted || !isOnline) return;
    void flushSmartCaptureQueue();
  }, [mounted, isOnline]);

  useEffect(() => {
    if (!mounted) return;
    const onEvent = () => {
      if (navigator.onLine) void flushSmartCaptureQueue();
    };
    window.addEventListener(SMART_CAPTURE_SYNC_EVENT, onEvent);
    return () => window.removeEventListener(SMART_CAPTURE_SYNC_EVENT, onEvent);
  }, [mounted]);

  return null;
}

export function useSmartCaptureSyncPanel(): {
  snapshot: SyncPanelSnapshot | null;
  refresh: () => void;
  flush: () => Promise<void>;
} {
  const [snapshot, setSnapshot] = useState<SyncPanelSnapshot | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  const refresh = useCallback(() => {
    if (!userId) return;
    setSnapshot(getSyncPanel(userId));
  }, [userId]);

  useEffect(() => {
    void resolveUserId().then((id) => {
      setUserId(id);
      if (id) setSnapshot(getSyncPanel(id));
    });
  }, []);

  useEffect(() => {
    const onEvent = () => refresh();
    window.addEventListener(SMART_CAPTURE_SYNC_EVENT, onEvent);
    return () => window.removeEventListener(SMART_CAPTURE_SYNC_EVENT, onEvent);
  }, [refresh]);

  return {
    snapshot,
    refresh,
    flush: async () => {
      await flushSmartCaptureQueue(userId);
      refresh();
    },
  };
}
