"use client";

import { useCallback, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { OFFLINE_SYNC_EVENT } from "@/lib/offline/constants";
import {
  flushTripChecklistSeeds,
  queueTripChecklistSeed,
} from "@/lib/offline/trip-checklist-queue";
import { useSupabaseCrud } from "./use-supabase-crud";
import { useOnlineStatus } from "./use-online-status";
import type { TableInsert } from "@/types/database";
import { resolveChecklistSeed } from "@/utils/travel";

type CreateTripPayload = Omit<TableInsert<"trips">, "user_id">;

async function seedChecklistOnline(
  tripId: string,
  templateId: string | null | undefined
): Promise<string | null> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return "Usuário não autenticado.";

  const items = resolveChecklistSeed(templateId);
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const { error } = await supabase.from("trip_checklist_items").insert({
      user_id: user.id,
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

async function seedChecklist(
  tripId: string,
  templateId: string | null | undefined,
  isOnline: boolean
): Promise<string | null> {
  if (!isOnline) {
    queueTripChecklistSeed(tripId, templateId ?? null);
    return null;
  }
  return seedChecklistOnline(tripId, templateId);
}

export function useTrips() {
  const isOnline = useOnlineStatus();
  const crud = useSupabaseCrud<"trips">({
    table: "trips",
    orderBy: "data_ida",
    ascending: true,
  });

  useEffect(() => {
    if (!isOnline) return;

    void flushTripChecklistSeeds();

    function onSync() {
      void flushTripChecklistSeeds();
    }

    window.addEventListener(OFFLINE_SYNC_EVENT, onSync);
    return () => window.removeEventListener(OFFLINE_SYNC_EVENT, onSync);
  }, [isOnline]);

  const create = useCallback(
    async (payload: CreateTripPayload) => {
      const result = await crud.create(payload);
      if (result.data?.id) {
        const seedError = await seedChecklist(
          result.data.id,
          payload.template_id ?? null,
          isOnline
        );
        if (seedError) {
          return { ...result, error: seedError };
        }
      }
      return result;
    },
    [crud.create, isOnline]
  );

  return {
    ...crud,
    create,
  };
}
