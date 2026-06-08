import type { Cliente, CommunicationLog, GrowthLead, Orcamento } from "@/types/database";
import { normalizeOrcamentoStatus } from "@/utils/alvesz-integration";
import { listStaleOpportunities } from "@/utils/follow-up";

export type CommsOperationalStats = {
  semResposta: number;
  aguardandoRetorno: number;
  followUpPendente: number;
};

function sentProposalsAwaiting(logs: CommunicationLog[], orcamentos: Orcamento[]) {
  const openedOrcamentoIds = new Set(
    logs
      .filter((l) => l.status === "opened" || l.opened_at)
      .map((l) => l.orcamento_id)
      .filter(Boolean) as string[]
  );

  const fromLogs = logs.filter(
    (l) =>
      l.channel === "email" &&
      l.direction === "outbound" &&
      l.status === "sent" &&
      (l.proposta_id || l.orcamento_id)
  ).length;

  const fromOrcamentos = orcamentos.filter((o) => {
    const status = normalizeOrcamentoStatus(o.status);
    return (
      (status === "enviado" || status === "negociacao") &&
      !openedOrcamentoIds.has(o.id)
    );
  }).length;

  return Math.max(fromLogs, fromOrcamentos);
}

export function computeCommsOperationalStats(
  logs: CommunicationLog[],
  leads: GrowthLead[],
  orcamentos: Orcamento[],
  clientes: Cliente[] = []
): CommsOperationalStats {
  const stale = listStaleOpportunities({ leads, orcamentos, clientes });
  const followUpPendente = stale.length;
  const semResposta = stale.filter(
    (s) => s.context.idleTier === 7 || s.context.idleTier === 14
  ).length;
  const aguardandoRetorno = sentProposalsAwaiting(logs, orcamentos);

  return { semResposta, aguardandoRetorno, followUpPendente };
}
