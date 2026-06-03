"use client";

import { useSupabaseCrud } from "./use-supabase-crud";

export function useAlveszPropostas() {
  return useSupabaseCrud<"alvesz_propostas">({
    table: "alvesz_propostas",
    orderBy: "created_at",
    ascending: false,
  });
}
