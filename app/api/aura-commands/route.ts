import { executeAuraCommand, listAuraCommandHistory, logAuraCommandHistory } from "@/lib/aura-commands";
import { persistAiTurn } from "@/lib/ai/memory-runtime";
import type { PendingAuraCommand } from "@/utils/aura-commands";
import { formatCommandSuccessMessage } from "@/utils/aura-commands";
import { parseRequestJson } from "@/utils/safe-json";

export async function GET() {
  try {
    const { entries, error } = await listAuraCommandHistory(20);

    if (error) {
      const status = error === "Usuário não autenticado." ? 401 : 500;
      return Response.json({ error }, { status });
    }

    return Response.json({ entries });
  } catch (error) {
    console.error("[aura-commands] GET error:", error);
    return Response.json({ error: "Erro ao carregar histórico." }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { data: body, error: bodyError } = await parseRequestJson<{
      pendingCommand?: PendingAuraCommand;
      confirm?: boolean;
    }>(req);

    if (bodyError || !body?.pendingCommand) {
      return Response.json(
        { error: bodyError ?? "Comando pendente não informado." },
        { status: 400 }
      );
    }

    if (!body.confirm) {
      return Response.json({ error: "Confirmação necessária." }, { status: 400 });
    }

    const pending = body.pendingCommand;
    const { result, error: execError } = await executeAuraCommand(pending);

    await logAuraCommandHistory({
      pending,
      result: execError ? null : result,
      status: execError ? "error" : "success",
      errorMessage: execError,
    });

    if (execError) {
      return Response.json({ error: execError }, { status: 422 });
    }

    const text = formatCommandSuccessMessage(pending.commandId, result);
    await persistAiTurn("aura_central", `[comando] ${pending.summary}`, text, {
      kind: "command",
      commandId: pending.commandId,
      executed: true,
    });

    return Response.json({
      text,
      module: pending.module,
      kind: "command",
      executed: true,
      result,
      pendingCommand: null,
    });
  } catch (error) {
    console.error("[aura-commands] POST error:", error);
    return Response.json({ error: "Erro ao executar comando." }, { status: 500 });
  }
}
