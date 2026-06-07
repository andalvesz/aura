import {
  clearSystemLogs,
  listSystemLogs,
} from "@/lib/logs/system-log.service";
import type { SystemLogTipo } from "@/types/database";

const VALID_TIPOS = new Set<SystemLogTipo>(["error", "warning", "info", "success"]);

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const tipo = searchParams.get("tipo");
    const modulo = searchParams.get("modulo");
    const from = searchParams.get("from") ?? undefined;
    const to = searchParams.get("to") ?? undefined;

    const { logs, error } = await listSystemLogs({
      tipo:
        tipo && VALID_TIPOS.has(tipo as SystemLogTipo)
          ? (tipo as SystemLogTipo)
          : tipo === "all"
            ? "all"
            : undefined,
      modulo: modulo && modulo !== "all" ? modulo : modulo === "all" ? "all" : undefined,
      from,
      to,
    });

    if (error === "Usuário não autenticado.") {
      return Response.json({ error }, { status: 401 });
    }

    if (error) {
      return Response.json({ error, logs: [] }, { status: 500 });
    }

    return Response.json({ logs });
  } catch (error) {
    console.error("[system-logs] GET", error);
    return Response.json({ error: "Erro ao carregar logs.", logs: [] }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const tipoParam = searchParams.get("tipo");
    const moduloParam = searchParams.get("modulo");

    const { deleted, error } = await clearSystemLogs({
      tipo:
        tipoParam && (tipoParam === "all" || VALID_TIPOS.has(tipoParam as SystemLogTipo))
          ? (tipoParam as SystemLogTipo | "all")
          : undefined,
      modulo:
        moduloParam && moduloParam !== "all"
          ? moduloParam
          : moduloParam === "all"
            ? "all"
            : undefined,
    });

    if (error === "Usuário não autenticado.") {
      return Response.json({ error }, { status: 401 });
    }

    if (error) {
      return Response.json({ error, deleted: 0 }, { status: 500 });
    }

    return Response.json({ deleted, ok: true });
  } catch (error) {
    console.error("[system-logs] DELETE", error);
    return Response.json({ error: "Erro ao limpar logs.", deleted: 0 }, { status: 500 });
  }
}
