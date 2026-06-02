"use client";

import { useSupabaseCrud } from "./use-supabase-crud";

export function useHealthMeals() {
  return useSupabaseCrud<"health_meals">({
    table: "health_meals",
    orderBy: "horario",
    ascending: true,
  });
}
