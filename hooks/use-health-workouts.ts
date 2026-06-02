"use client";

import { useSupabaseCrud } from "./use-supabase-crud";

export function useHealthWorkouts() {
  return useSupabaseCrud<"health_workouts">({
    table: "health_workouts",
    orderBy: "data",
    ascending: false,
  });
}
