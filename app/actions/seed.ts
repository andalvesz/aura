"use server";

import { revalidatePath } from "next/cache";
import { seedDemoData } from "@/lib/supabase/services/seed.service";

export async function runSeedDemo() {
  const { error } = await seedDemoData();
  if (error) return { error };
  revalidatePath("/dashboard", "layout");
  return { success: true };
}
