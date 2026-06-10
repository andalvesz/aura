import { connectPlatform } from "@/lib/supabase/services/platform-hub.service";
import type { PlatformAuthType, PlatformId } from "@/lib/platforms/types";
import { parseRequestJson } from "@/utils/safe-json";

export async function POST(request: Request) {
  const { data: body, error: parseError } = await parseRequestJson<{
    platform?: PlatformId;
    authType?: PlatformAuthType;
    credentials?: Record<string, string>;
    accountLabel?: string;
  }>(request);

  if (parseError || !body?.platform || !body.credentials) {
    return Response.json({ error: parseError ?? "Dados inválidos." }, { status: 400 });
  }

  const { connection, error } = await connectPlatform({
    platform: body.platform,
    authType: body.authType ?? "api_key",
    credentials: body.credentials,
    accountLabel: body.accountLabel,
  });

  if (error) {
    return Response.json(
      { error },
      { status: error === "Usuário não autenticado." ? 401 : 400 }
    );
  }

  return Response.json({ connection });
}
