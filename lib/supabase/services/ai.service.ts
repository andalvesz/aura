import { AiMessagesRepository } from "@/lib/supabase/repositories";
import type { AiModule } from "@/types/database";
import { getDataContext } from "./context";

export async function listAiMessages(module: AiModule, limit = 50) {
  const { supabase, userId } = await getDataContext();
  return new AiMessagesRepository(supabase, userId).findByModule(module, limit);
}

export async function appendAiMessage(
  module: AiModule,
  role: "user" | "assistant" | "system",
  content: string,
  metadata: Record<string, unknown> = {}
) {
  const { supabase, userId } = await getDataContext();
  return new AiMessagesRepository(supabase, userId).append(
    module,
    role,
    content,
    metadata
  );
}
