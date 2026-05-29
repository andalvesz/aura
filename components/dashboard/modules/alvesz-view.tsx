"use client";

import { Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { EmptyState } from "@/components/dashboard/empty-state";
import {
  ListSkeleton,
  MetricsSkeleton,
} from "@/components/dashboard/loading-skeleton";
import { useClientes, useEstoque, useOrcamentos } from "@/hooks";
import {
  calcPrecoSugerido,
  ESTOQUE_STATUS_STYLE,
  estoqueStatus,
} from "@/utils/alvesz";
import { formatBRL } from "@/utils/format";
import { ActionButton } from "../action-button";
import { MetricCard } from "../metric-card";
import { Panel, PanelContent, PanelHeader, PanelTitle } from "../panel";
import { AddOrcamentoModal } from "./add-orcamento-modal";

export function AlveszView() {
  const { data: estoque, loading: loadingEstoque } = useEstoque();
  const { data: clientes, loading: loadingClientes } = useClientes();

  const {
    data: orcamentos,
    loading: loadingOrcamentos,
    create: createOrcamento,
  } = useOrcamentos();

  const [modalOpen, setModalOpen] = useState(false);
  const [convidados, setConvidados] = useState(0);
  const [horas, setHoras] = useState(0);

  const loading = loadingEstoque || loadingClientes || loadingOrcamentos;

  const critical = useMemo(
    () =>
      estoque.filter(
        (i) =>
          estoqueStatus(Number(i.quantidade), Number(i.minimo_alerta)) !== "ok"
      ),
    [estoque]
  );

  const pendentes = orcamentos.filter(
    (o) => o.status === "pendente" || o.status === "rascunho"
  );

  const pipelineTotal = pendentes.reduce(
    (s, o) => s + Number(o.valor_total),
    0
  );

  const faturamentoPrevisto = orcamentos
    .filter((o) => o.status !== "cancelado")
    .reduce((s, o) => s + Number(o.valor_total), 0);

  const precoSugerido =
    convidados > 0 && horas > 0 ? calcPrecoSugerido(convidados, horas) : 0;

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <ActionButton
          icon={<Plus className="size-3.5" />}
          onClick={() => setModalOpen(true)}
        >
          Novo orçamento
        </ActionButton>
      </div>

      {loading ? (
        <MetricsSkeleton />
      ) : (
        <div className="grid grid-cols-2 gap-2 xl:grid-cols-4">
          <MetricCard
            label="Orçamentos"
            value={String(orcamentos.length)}
            hint={`${pendentes.length} pendentes`}
          />

          <MetricCard
            label="Pipeline pendente"
            value={formatBRL(pipelineTotal)}
            hint={`${pendentes.length} propostas`}
          />

          <MetricCard
            label="Estoque crítico"
            value={`${critical.length} itens`}
            hint={critical.map((c) => c.produto).join(", ") || "Tudo ok"}
            hintClassName={
              critical.length ? "text-red-400/90" : "text-emerald-400/90"
            }
          />

          <MetricCard
            label="Faturamento previsto"
            value={formatBRL(faturamentoPrevisto)}
            hint="Total de orçamentos cadastrados"
          />
        </div>
      )}

      <div className="grid gap-2 lg:grid-cols-3">
        <Panel>
          <PanelHeader>
            <PanelTitle>Pacotes</PanelTitle>
          </PanelHeader>

          <PanelContent className="pt-0">
            <EmptyState
              title="Nenhum pacote cadastrado"
              description="Crie seus pacotes personalizados da Alvesz Experience."
            />
          </PanelContent>
        </Panel>

        <Panel>
          <PanelHeader>
            <PanelTitle>Estoque</PanelTitle>
          </PanelHeader>

          <PanelContent className="overflow-x-auto pt-0">
            {loadingEstoque ? (
              <ListSkeleton rows={5} />
            ) : estoque.length === 0 ? (
              <EmptyState
                title="Estoque vazio"
                description="Cadastre seus primeiros itens de estoque."
              />
            ) : (
              <table className="w-full min-w-[220px] text-[12px]">
                <thead>
                  <tr className="text-left text-[10px] text-zinc-600">
                    <th className="pb-2 font-medium">Item</th>
                    <th className="pb-2 font-medium">Qtd</th>
                    <th className="pb-2 font-medium">Status</th>
                  </tr>
                </thead>

                <tbody>
                  {estoque.map((row) => {
                    const status = estoqueStatus(
                      Number(row.quantidade),
                      Number(row.minimo_alerta)
                    );

                    return (
                      <tr
                        key={row.id}
                        className="border-t border-white/[0.04] text-zinc-300"
                      >
                        <td className="py-2">{row.produto}</td>

                        <td className="py-2 text-zinc-500">
                          {row.quantidade} {row.unidade}
                        </td>

                        <td
                          className={`py-2 capitalize ${ESTOQUE_STATUS_STYLE[status]}`}
                        >
                          {status}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </PanelContent>
        </Panel>

        <Panel>
          <PanelHeader>
            <PanelTitle>Orçamentos recentes</PanelTitle>
          </PanelHeader>

          <PanelContent className="space-y-2 pt-0">
            {loadingOrcamentos ? (
              <ListSkeleton rows={4} />
            ) : orcamentos.length === 0 ? (
              <EmptyState
                title="Nenhum orçamento"
                description="Crie seu primeiro orçamento para começar."
                action={
                  <ActionButton onClick={() => setModalOpen(true)}>
                    Criar orçamento
                  </ActionButton>
                }
              />
            ) : (
              orcamentos.slice(0, 5).map((o) => (
                <div
                  key={o.id}
                  className="rounded-md border border-white/[0.04] p-2.5"
                >
                  <p className="text-[13px] font-medium text-zinc-200">
                    {o.tipo_evento}
                  </p>

                  <p className="text-[12px] text-violet-300/90">
                    {formatBRL(Number(o.valor_total))}
                  </p>

                  <p className="text-[11px] text-zinc-600">
                    {o.cliente_id
                      ? clientes.find((c) => c.id === o.cliente_id)?.nome ??
                        "Cliente"
                      : "Sem cliente"}{" "}
                    · {o.convidados} conv. · {o.status}
                  </p>
                </div>
              ))
            )}
          </PanelContent>
        </Panel>
      </div>

      <Panel>
        <PanelHeader>
          <PanelTitle>Simulador de precificação</PanelTitle>
        </PanelHeader>

        <PanelContent className="grid gap-3 pt-0 sm:grid-cols-2">
          <div className="grid grid-cols-2 gap-2 text-[11px]">
            <label className="text-zinc-600">
              Convidados
              <input
                type="number"
                min={0}
                value={convidados}
                onChange={(e) => setConvidados(Number(e.target.value) || 0)}
                className="mt-1 w-full rounded-md border border-white/[0.06] bg-white/[0.02] px-2 py-1.5 text-zinc-200"
              />
            </label>

            <label className="text-zinc-600">
              Horas
              <input
                type="number"
                min={0}
                value={horas}
                onChange={(e) => setHoras(Number(e.target.value) || 0)}
                className="mt-1 w-full rounded-md border border-white/[0.06] bg-white/[0.02] px-2 py-1.5 text-zinc-200"
              />
            </label>
          </div>

          <div className="rounded-md bg-violet-500/10 p-2.5">
            <p className="text-[10px] text-zinc-500">Preço sugerido</p>

            <p className="text-xl font-semibold text-zinc-100">
              {precoSugerido > 0 ? formatBRL(precoSugerido) : "—"}
            </p>

            <p className="text-[11px] text-zinc-500">
              {precoSugerido > 0
                ? `Lucro estimado ~${formatBRL(precoSugerido * 0.38)}`
                : "Informe convidados e horas para calcular."}
            </p>
          </div>
        </PanelContent>
      </Panel>

      <AddOrcamentoModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        clientes={clientes}
        onSubmit={async (payload) => {
          const result = await createOrcamento(payload);
          return { error: result.error };
        }}
      />
    </div>
  );
}