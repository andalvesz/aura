"use client";

import { useSupabaseCrud } from "./use-supabase-crud";

export function useEstoque() {
  return useSupabaseCrud<"estoque">({
    table: "estoque",
    orderBy: "produto",
    ascending: true,
  });
}
