"use client";

import { useSupabaseCrud } from "./use-supabase-crud";

export function useAlveszEventos() {
  return useSupabaseCrud<"alvesz_eventos">({
    table: "alvesz_eventos",
    orderBy: "data_evento",
    ascending: true,
  });
}
