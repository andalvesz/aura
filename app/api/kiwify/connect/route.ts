import {
  connectKiwify,
  disconnectKiwify,
} from "@/lib/supabase/services/kiwify-connect.service";
import { parseRequestJson } from "@/utils/safe-json";

function mapConnectError(err: unknown): string {
  const message = err instanceof Error ? err.message : "Erro ao conectar Kiwify.";
  if (message.includes("PLATFORM_CREDENTIALS_KEY")) {
    return "PLATFORM_CREDENTIALS_KEY não configurada na Vercel.";
  }
  return message;
}

export async function POST(req: Request) {
  try {
    const { data: body, error: parseError } = await parseRequestJson<{
      clientId?: string;
      clientSecret?: string;
      accountId?: string;
      accountLabel?: string;
    }>(req);

    if (parseError) {
      return Response.json({ error: parseError }, { status: 400 });
    }

    if (!body?.clientId?.trim() || !body?.clientSecret?.trim() || !body?.accountId?.trim()) {
      return Response.json(
        { error: "clientId, clientSecret e accountId são obrigatórios." },
        { status: 400 }
      );
    }

    const { error } = await connectKiwify({
      clientId: body.clientId,
      clientSecret: body.clientSecret,
      accountId: body.accountId,
      accountLabel: body.accountLabel,
    });

    if (error) {
      return Response.json({ error }, { status: 422 });
    }

    return Response.json({ ok: true });
  } catch (err) {
    console.error("[kiwify/connect]", err);
    return Response.json({ error: mapConnectError(err) }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    const { error } = await disconnectKiwify();
    if (error) {
      return Response.json({ error }, { status: 400 });
    }
    return Response.json({ ok: true });
  } catch (err) {
    console.error("[kiwify/connect DELETE]", err);
    return Response.json({ error: mapConnectError(err) }, { status: 500 });
  }
}
