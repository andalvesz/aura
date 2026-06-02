"use client";

import { useSupabaseCrud } from "./use-supabase-crud";

export function useConteudos() {
  return useSupabaseCrud<"conteudos">({
    table: "conteudos",
    orderBy: "created_at",
    ascending: false,
  });
}
