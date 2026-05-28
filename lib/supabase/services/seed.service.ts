import { getDataContext } from "./context";

/** Insere dados demo via RPC (idempotente por usuário) */
export async function seedDemoData() {
  const { supabase } = await getDataContext();
  const { error } = await supabase.rpc("seed_demo_data");
  return { error: error?.message ?? null };
}
