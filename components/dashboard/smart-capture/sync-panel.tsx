"use client";

import { useSmartCaptureSyncPanel } from "@/components/dashboard/smart-capture/smart-capture-offline-sync";

export function SyncPanel({ compact = false }: { compact?: boolean }) {
  const { snapshot, flush, refresh } = useSmartCaptureSyncPanel();

  if (!snapshot) {
    return (
      <div
        className="rounded-lg border border-white/10 bg-zinc-950/50 p-3 text-[12px] text-zinc-500"
        data-testid="sync-panel"
      >
        Carregando sincronizações…
      </div>
    );
  }

  return (
    <div
      className="rounded-lg border border-white/10 bg-zinc-950/50 p-3"
      data-testid="sync-panel"
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="text-[13px] font-medium text-zinc-100">Sincronizações</h3>
        <div className="flex gap-2">
          <button
            type="button"
            className="text-[10px] text-zinc-500 hover:text-zinc-300"
            onClick={refresh}
          >
            Atualizar
          </button>
          <button
            type="button"
            className="text-[10px] text-cyan-400 hover:text-cyan-300"
            onClick={() => void flush()}
          >
            Sincronizar agora
          </button>
        </div>
      </div>
      <dl className="grid grid-cols-2 gap-2 text-[11px] sm:grid-cols-4">
        <div>
          <dt className="text-zinc-600">Pendentes</dt>
          <dd className="text-zinc-200">{snapshot.pending}</dd>
        </div>
        <div>
          <dt className="text-zinc-600">Enviadas</dt>
          <dd className="text-emerald-300">{snapshot.sent}</dd>
        </div>
        <div>
          <dt className="text-zinc-600">Falhas</dt>
          <dd className="text-rose-300">{snapshot.failed}</dd>
        </div>
        <div>
          <dt className="text-zinc-600">Última sync</dt>
          <dd className="text-zinc-400">
            {snapshot.lastSyncAt
              ? new Date(snapshot.lastSyncAt).toLocaleString("pt-BR")
              : "—"}
          </dd>
        </div>
      </dl>
      {!compact && snapshot.items.length > 0 ? (
        <ul className="mt-3 max-h-48 space-y-1 overflow-y-auto">
          {snapshot.items.slice(0, 20).map((item) => (
            <li
              key={item.id}
              className="flex items-center justify-between gap-2 rounded border border-white/[0.04] px-2 py-1 text-[10px]"
            >
              <span className="truncate text-zinc-400">
                {item.payload.title ||
                  item.payload.description.slice(0, 40) ||
                  item.id}
              </span>
              <span
                className={
                  item.status === "sent"
                    ? "text-emerald-400"
                    : item.status === "failed"
                      ? "text-rose-400"
                      : "text-amber-300"
                }
              >
                {item.status}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
