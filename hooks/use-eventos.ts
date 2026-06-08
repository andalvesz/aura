"use client";

import { useCallback } from "react";
import { toast } from "sonner";
import { useSupabaseCrud } from "./use-supabase-crud";
import type { TableInsert, TableUpdate } from "@/types/database";
import { parseJsonResponse } from "@/utils/safe-json";

async function pushEventoToGoogleApi(eventoId: string): Promise<{
  synced: boolean;
  skipped: boolean;
  error: string | null;
}> {
  try {
    const res = await fetch("/api/google-calendar/push", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ eventoId }),
    });

    const { data, error: parseError } = await parseJsonResponse<{
      synced?: boolean;
      skipped?: boolean;
      error?: string;
    }>(res);

    if (parseError) {
      return { synced: false, skipped: false, error: parseError };
    }

    if (!res.ok) {
      return {
        synced: false,
        skipped: false,
        error: data?.error ?? "Falha ao sincronizar com Google Calendar.",
      };
    }

    return {
      synced: Boolean(data?.synced),
      skipped: Boolean(data?.skipped),
      error: null,
    };
  } catch {
    return {
      synced: false,
      skipped: false,
      error: "Erro de rede ao sincronizar com Google Calendar.",
    };
  }
}

export function useEventos() {
  const crud = useSupabaseCrud<"eventos">({
    table: "eventos",
    orderBy: "data_inicio",
    ascending: true,
  });

  const syncToGoogle = useCallback(
    async (eventoId: string, options?: { silent?: boolean }) => {
      const result = await pushEventoToGoogleApi(eventoId);
      await crud.refresh();

      if (!options?.silent) {
        if (result.error) {
          toast.error(result.error);
        } else if (result.synced) {
          toast.success("Evento sincronizado com Google Calendar.");
        }
      }

      return result;
    },
    [crud.refresh]
  );

  const create = useCallback(
    async (payload: Omit<TableInsert<"eventos">, "user_id">) => {
      const result = await crud.create(payload);
      if (result.data?.id) {
        void syncToGoogle(result.data.id);
      }
      return result;
    },
    [crud.create, syncToGoogle]
  );

  const update = useCallback(
    async (id: string, payload: TableUpdate<"eventos">) => {
      const result = await crud.update(id, payload);
      if (result.data?.id) {
        void syncToGoogle(result.data.id);
      }
      return result;
    },
    [crud.update, syncToGoogle]
  );

  const remove = useCallback(
    async (id: string) => {
      const existing = crud.data.find((e) => e.id === id);
      if (existing?.google_event_id) {
        try {
          const res = await fetch("/api/google-calendar/remove", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ googleEventId: existing.google_event_id }),
          });
          if (!res.ok) {
            const { data } = await parseJsonResponse<{ error?: string }>(res);
            toast.error(data?.error ?? "Não foi possível remover do Google Calendar.");
          }
        } catch {
          toast.error("Erro de rede ao remover do Google Calendar.");
        }
      }
      return crud.remove(id);
    },
    [crud.remove, crud.data]
  );

  return {
    ...crud,
    create,
    update,
    remove,
    syncToGoogle,
  };
}
