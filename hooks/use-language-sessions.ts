"use client";

import { useSupabaseCrud } from "./use-supabase-crud";

export function useLanguageSessions() {
  return useSupabaseCrud<"language_sessions">({
    table: "language_sessions",
    orderBy: "data",
    ascending: false,
  });
}
