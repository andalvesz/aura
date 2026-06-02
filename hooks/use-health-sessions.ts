"use client";

import { useSupabaseCrud } from "./use-supabase-crud";

export function useHealthSessions() {
  return useSupabaseCrud<"health_sessions">({
    table: "health_sessions",
    orderBy: "data",
    ascending: false,
  });
}
