import { syncPlatformConnection } from "@/lib/supabase/services/platform-hub.service";
import type { PlatformId } from "@/lib/platforms/types";
import { parseRequestJson } from "@/utils/safe-json";

export async function POST(request: Request) {
  const { data: body } = await parseRequestJson<{ platform?: PlatformId }>(request);

  const { logs, error } = await syncPlatformConnection(body?.platform);

  if (error && logs.length === 0) {
    return Response.json(
      { error },
      { status: error === "Usuário não autenticado." ? 401 : 400 }
    );
  }

  return Response.json({ logs, error });
}
