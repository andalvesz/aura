"use client";

import { useSupabaseCrud } from "./use-supabase-crud";

export function useHealthHabits() {
  return useSupabaseCrud<"health_habits">({
    table: "health_habits",
    orderBy: "data",
    ascending: false,
  });
}
