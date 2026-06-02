"use client";

import { WifiOff } from "lucide-react";
import { useHasMounted } from "@/hooks/use-has-mounted";
import { useOnlineStatus } from "@/hooks/use-online-status";

export function OfflineBadge() {
  const mounted = useHasMounted();
  const isOnline = useOnlineStatus();

  if (!mounted || isOnline) return null;

  return (
    <span
      className="flex h-8 shrink-0 items-center gap-1 rounded-md border border-amber-500/30 bg-amber-500/15 px-2 text-[11px] font-medium text-amber-100/95 sm:px-2.5 sm:text-[12px]"
      title="Sem conexão — alterações são salvas localmente e sincronizadas ao voltar a internet"
    >
      <WifiOff className="size-3 shrink-0" aria-hidden />
      Modo Offline
    </span>
  );
}
