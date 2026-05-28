import { getUser, requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export async function getDataContext() {
  const user = await requireUser();
  const supabase = await createClient();
  return { user, supabase, userId: user.id };
}

export async function getOptionalDataContext() {
  const user = await getUser();
  if (!user) return null;
  const supabase = await createClient();
  return { user, supabase, userId: user.id };
}
