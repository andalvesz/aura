"use client";

import { useCallback } from "react";
import { useSupabaseCrud } from "./use-supabase-crud";
import type { TableInsert, TableUpdate } from "@/types/database";

async function pushEventoToGoogleApi(eventoId: string) {
  try {
    await fetch("/api/google-calendar/push", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ eventoId }),
    });
  } catch {
    /* falha Google não bloqueia CRUD local */
  }
}

export function useEventos() {
  const crud = useSupabaseCrud<"eventos">({
    table: "eventos",
    orderBy: "data_inicio",
    ascending: true,
  });

  const create = useCallback(
    async (payload: Omit<TableInsert<"eventos">, "user_id">) => {
      const result = await crud.create(payload);
      if (result.data?.id) {
        void pushEventoToGoogleApi(result.data.id);
      }
      return result;
    },
    [crud.create]
  );

  const update = useCallback(
    async (id: string, payload: TableUpdate<"eventos">) => {
      const result = await crud.update(id, payload);
      if (result.data?.id) {
        void pushEventoToGoogleApi(result.data.id);
      }
      return result;
    },
    [crud.update]
  );

  const remove = useCallback(
    async (id: string) => {
      const existing = crud.data.find((e) => e.id === id);
      if (existing?.google_event_id) {
        try {
          await fetch("/api/google-calendar/remove", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ googleEventId: existing.google_event_id }),
          });
        } catch {
          /* continua exclusão local */
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
  };
}
