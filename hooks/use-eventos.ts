"use client";

import { useSupabaseCrud } from "./use-supabase-crud";

export function useEventos() {
  return useSupabaseCrud<"eventos">({
    table: "eventos",
    orderBy: "data_inicio",
    ascending: true,
  });
}
