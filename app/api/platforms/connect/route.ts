import { connectPlatform } from "@/lib/supabase/services/platform-hub.service";
import type { PlatformAuthType, PlatformId } from "@/lib/platforms/types";
import { parseRequestJson } from "@/utils/safe-json";

function mapConnectError(err: unknown): string {
  const message = err instanceof Error ? err.message : "Erro ao conectar plataforma.";
  if (message.includes("PLATFORM_CREDENTIALS_KEY")) {
    return "PLATFORM_CREDENTIALS_KEY não configurada na Vercel.";
  }
  return message;
}

export async function POST(request: Request) {
  try {
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
  } catch (err) {
    console.error("[platforms/connect]", err);
    return Response.json({ error: mapConnectError(err) }, { status: 500 });
  }
}
