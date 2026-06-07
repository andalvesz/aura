"use client";

import { useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useSupabaseCrud } from "./use-supabase-crud";
import type { TableInsert } from "@/types/database";
import { resolveChecklistSeed } from "@/utils/travel";

type CreateTripPayload = Omit<TableInsert<"trips">, "user_id">;

async function seedChecklist(
  tripId: string,
  templateId: string | null | undefined
) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const items = resolveChecklistSeed(templateId);
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    await supabase.from("trip_checklist_items").insert({
      user_id: user.id,
      trip_id: tripId,
      categoria: item.categoria,
      titulo: item.titulo,
      status: "pendente",
      ordem: i,
    });
  }
}

export function useTrips() {
  const crud = useSupabaseCrud<"trips">({
    table: "trips",
    orderBy: "data_ida",
    ascending: true,
  });

  const create = useCallback(
    async (payload: CreateTripPayload) => {
      const result = await crud.create(payload);
      if (result.data?.id) {
        await seedChecklist(result.data.id, payload.template_id ?? null);
      }
      return result;
    },
    [crud.create]
  );

  return {
    ...crud,
    create,
  };
}
