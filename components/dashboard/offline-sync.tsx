"use client";

import { useEffect, useRef } from "react";
import { flushOfflineSyncQueue } from "@/lib/offline/sync";
import { useHasMounted } from "@/hooks/use-has-mounted";
import { useOnlineStatus } from "@/hooks/use-online-status";

/** Sincroniza fila offline com Supabase quando a conexão volta. */
export function OfflineSync() {
  const mounted = useHasMounted();
  const isOnline = useOnlineStatus();
  const wasOffline = useRef(false);

  useEffect(() => {
    if (!mounted) return;

    if (!isOnline) {
      wasOffline.current = true;
      return;
    }

    if (!wasOffline.current) return;
    wasOffline.current = false;

    void flushOfflineSyncQueue();
  }, [mounted, isOnline]);

  useEffect(() => {
    if (!mounted || !isOnline) return;

    const onVisible = () => {
      if (document.visibilityState === "visible" && navigator.onLine) {
        void flushOfflineSyncQueue();
      }
    };

    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [mounted, isOnline]);

  return null;
}
