"use client";

import {
  DollarSign,
  Loader2,
  Megaphone,
  Send,
  Sparkles,
  Target,
  Trash2,
  Users,
} from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ActionButton } from "@/components/dashboard/action-button";
import { AvailableBudgetField } from "@/components/dashboard/available-budget-field";
import { EmptyState } from "@/components/dashboard/empty-state";
import { ListSkeleton, MetricsSkeleton } from "@/components/dashboard/loading-skeleton";
import { MetricCard } from "@/components/dashboard/metric-card";
import { Panel, PanelContent, PanelHeader, PanelTitle } from "@/components/dashboard/panel";
import { useAdsManager } from "@/hooks/use-ads-manager";
import { useCreator } from "@/hooks/use-creator";
import type { CreatorAdsCampaign } from "@/types/database";
import {
  ADS_IA_ACTIONS,
  ADS_OBJETIVOS,
  ADS_ORCAMENTO_NIVEIS,
  formatBRL,
  formatInvestimentoRange,
  getObjetivoLabel,
  getOrcamentoLabel,
  intakeFromProductBundle,
  parseAnuncios,
  parseConjuntos,
  parsePublicos,
  type AdsIntake,
} from "@/utils/ads-manager";
import { parseJsonResponse } from "@/utils/safe-json";
import { cn } from "@/utils/cn";

const EMPTY_INTAKE: AdsIntake = {
  nome: "",
  avatar: "",
  problema: "",
  solucao: "",
  promessa: "",
  diferencial: "",
  preco: null,
  product_id: null,
  copylab_id: null,
  asset_id: null,
  landing_id: null,
  objetivo: null,
  orcamento_nivel: null,
  orcamento_disponivel: null,
};

function CampaignDetail({
  record,
  onDelete,
  busy,
}: {
  record: CreatorAdsCampaign;
  onDelete: () => void;
  busy: boolean;
}) {
  const publicos = parsePublicos(record.publicos);
  const conjuntos = parseConjuntos(record.conjuntos_anuncios);
  const anuncios = parseAnuncios(record.anuncios);

  return (
    <div className="space-y-4 text-[12px]">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-md bg-amber-500/15 px-2 py-0.5 text-[10px] font-medium text-amber-300">
          Rascunho — não publicado
        </span>
        {record.product_id && (
          <Link href="/dashboard/creator" className="text-[10px] text-violet-400 hover:underline">
            Produto →
          </Link>
        )}
        {record.asset_id && (
          <Link
            href="/dashboard/creator/studio"
            className="text-[10px] text-amber-400 hover:underline"
          >
            Criativo vinculado →
          </Link>
        )}
        {record.landing_id && (
          <Link
            href="/dashboard/creator/landing"
            className="text-[10px] text-sky-400 hover:underline"
          >
            Landing vinculada →
          </Link>
        )}
      </div>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-md border border-white/[0.06] bg-white/[0.02] p-3">
          <p className="text-[10px] text-zinc-500">Objetivo</p>
          <p className="font-medium text-zinc-200">{getObjetivoLabel(record.objetivo)}</p>
        </div>
        <div className="rounded-md border border-white/[0.06] bg-white/[0.02] p-3">
          <p className="text-[10px] text-zinc-500">Orçamento</p>
          <p className="font-medium text-zinc-200">{getOrcamentoLabel(record.orcamento_nivel)}</p>
        </div>
        <div className="rounded-md border border-emerald-500/15 bg-emerald-500/[0.04] p-3">
          <p className="text-[10px] text-emerald-400/80">Investimento diário</p>
          <p className="font-medium text-emerald-200">
            {formatInvestimentoRange(
              record.investimento_diario_min,
              record.investimento_diario_max
            )}
          </p>
        </div>
        <div className="rounded-md border border-emerald-500/15 bg-emerald-500/[0.04] p-3">
          <p className="text-[10px] text-emerald-400/80">Previsão mensal</p>
          <p className="font-medium text-emerald-200">
            {record.investimento_mensal_previsto
              ? formatBRL(record.investimento_mensal_previsto)
              : "—"}
          </p>
        </div>
      </div>

      {record.campanha_estrategia && (
        <div className="rounded-md border border-rose-500/15 bg-rose-500/[0.04] p-3">
          <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-rose-400/80">
            Estratégia da campanha
          </p>
          <p className="whitespace-pre-wrap text-[11px] leading-relaxed text-zinc-300">
            {record.campanha_estrategia}
          </p>
        </div>
      )}

      {publicos.length > 0 && (
        <div>
          <p className="mb-2 flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wide text-zinc-500">
            <Users className="size-3" />
            Públicos sugeridos
          </p>
          <div className="space-y-2">
            {publicos.map((p, i) => (
              <div key={i} className="rounded-md border border-white/[0.06] bg-white/[0.02] p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded bg-violet-500/20 px-1.5 py-0.5 text-[10px] text-violet-200">
                    {p.tipo}
                  </span>
                  <span className="font-medium text-zinc-200">{p.nome}</span>
                </div>
                <p className="mt-1 text-[11px] text-zinc-400">{p.targeting}</p>
                <p className="mt-1 text-[10px] text-zinc-500">{p.justificativa}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {conjuntos.length > 0 && (
        <div>
          <p className="mb-2 text-[10px] font-medium uppercase tracking-wide text-zinc-500">
            Conjuntos de anúncios
          </p>
          <div className="space-y-2">
            {conjuntos.map((c, i) => (
              <div key={i} className="rounded-md border border-white/[0.06] bg-white/[0.02] p-3">
                <p className="font-medium text-zinc-200">{c.nome}</p>
                <p className="text-[10px] text-zinc-500">
                  Público: {c.publico} · {formatBRL(c.orcamento_diario)}/dia
                </p>
                <p className="mt-1 text-[11px] text-zinc-400">{c.posicionamentos}</p>
                <p className="mt-1 text-[10px] text-zinc-500">{c.estrategia}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {anuncios.length > 0 && (
        <div>
          <p className="mb-2 text-[10px] font-medium uppercase tracking-wide text-zinc-500">
            Anúncios
          </p>
          <div className="space-y-2">
            {anuncios.map((a, i) => (
              <div
                key={i}
                className="rounded-md border border-rose-500/10 bg-rose-500/[0.03] p-3"
              >
                <p className="text-[10px] text-rose-400/70">
                  {a.conjunto} · {a.formato}
                </p>
                <p className="mt-1 text-[13px] font-semibold text-zinc-100">{a.headline}</p>
                <p className="mt-1 text-[11px] text-zinc-300">{a.texto_principal}</p>
                {a.descricao && (
                  <p className="mt-1 text-[10px] text-zinc-500">{a.descricao}</p>
                )}
                <p className="mt-2 text-[11px] font-medium text-rose-300">CTA: {a.cta}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <ActionButton
        variant="ghost"
        disabled={busy}
        icon={<Trash2 className="size-3.5" />}
        onClick={onDelete}
      >
        Excluir rascunho
      </ActionButton>
    </div>
  );
}

export function AdsManagerView() {
  const searchParams = useSearchParams();
  const { bundles } = useCreator();
  const {
    dashboard,
    records,
    assets,
    landings,
    loading,
    error,
    busy,
    refresh,
    generate,
    removeRecord,
  } = useAdsManager();

  const [intake, setIntake] = useState<AdsIntake>(EMPTY_INTAKE);
  const [activeRecord, setActiveRecord] = useState<CreatorAdsCampaign | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  const [iaInput, setIaInput] = useState("");
  const [iaLoading, setIaLoading] = useState(false);
  const [iaMessages, setIaMessages] = useState<{ role: "user" | "assistant"; text: string }[]>([
    {
      role: "assistant",
      text: "Sou a Aura Ads Manager — preparo campanhas em rascunho. Nada é publicado automaticamente.",
    },
  ]);

  useEffect(() => {
    const productId = searchParams.get("product_id");
    if (productId) {
      const bundle = bundles.find((b) => b.product.id === productId);
      if (bundle) {
        setIntake(intakeFromProductBundle(bundle));
        setShowForm(true);
      }
    }
  }, [searchParams, bundles]);

  async function handleGenerate() {
    if (!intake.orcamento_disponivel || intake.orcamento_disponivel <= 0) {
      toast.error("Informe seu Orçamento disponível.");
      return;
    }

    const payload: AdsIntake = {
      ...intake,
      campaign_id: activeRecord?.id ?? intake.campaign_id,
    };
    const { record, error: genError } = await generate(payload);
    if (genError || !record) {
      toast.error(genError ?? "Erro ao gerar campanha.");
      return;
    }
    setActiveRecord(record);
    setShowForm(false);
    toast.success("Campanha em rascunho criada!");
  }

  async function sendIaMessage(text: string, actionId?: string) {
    const trimmed = text.trim();
    if (!trimmed || iaLoading) return;

    setIaInput("");
    setIaLoading(true);
    const history = iaMessages.map((m) => ({ role: m.role, content: m.text }));
    setIaMessages((c) => [...c, { role: "user", text: trimmed }]);

    try {
      const res = await fetch("/api/creator-ia", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: trimmed,
          history,
          module: "ads",
          ...(actionId ? { actionId } : {}),
        }),
      });
      const { data: body, error: parseError } = await parseJsonResponse<{
        text?: string;
        error?: string;
      }>(res);

      if (parseError || !res.ok || body?.error) {
        setIaMessages((c) => [
          ...c,
          { role: "assistant", text: body?.error ?? parseError ?? "Erro na IA." },
        ]);
        return;
      }

      setIaMessages((c) => [
        ...c,
        { role: "assistant", text: body?.text ?? "Sem resposta." },
      ]);
    } catch {
      setIaMessages((c) => [...c, { role: "assistant", text: "Erro de conexão." }]);
    } finally {
      setIaLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-3">
        <MetricsSkeleton />
        <ListSkeleton rows={3} />
      </div>
    );
  }

  if (error && !dashboard) {
    return (
      <Panel className="border-rose-500/15 bg-rose-500/[0.03]">
        <PanelContent className="py-4 text-center text-[12px] text-rose-300">
          {error}
          <button
            type="button"
            onClick={() => void refresh()}
            className="mt-2 block w-full text-[11px] text-rose-200 underline"
          >
            Tentar novamente
          </button>
        </PanelContent>
      </Panel>
    );
  }

  return (
    <div className="space-y-3">
      <Panel className="border-amber-500/15 bg-amber-500/[0.03]">
        <PanelContent className="py-2.5 text-[11px] text-amber-200/90">
          Modo <strong>apenas rascunho</strong> — campanhas não são publicadas automaticamente nas
          plataformas de anúncios.
        </PanelContent>
      </Panel>

      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Campanhas"
          value={String(dashboard?.totalCampanhas ?? 0)}
          hint="Total em rascunho"
        />
        <MetricCard
          label="Último produto"
          value={dashboard?.ultimoProduto ?? "—"}
          hint="Nome da campanha"
        />
        <MetricCard
          label="Com criativos"
          value={String(dashboard?.comCriativos ?? 0)}
          hint="Vinculados ao Studio"
        />
        <MetricCard
          label="Com landing"
          value={String(dashboard?.comLanding ?? 0)}
          hint="Vinculadas ao Builder"
        />
      </div>

      <div className="flex flex-wrap gap-2">
        <ActionButton
          icon={<Megaphone className="size-3.5" />}
          onClick={() => {
            setShowForm(true);
            setIntake(EMPTY_INTAKE);
            setActiveRecord(null);
          }}
        >
          Nova campanha
        </ActionButton>
        {bundles.length > 0 && (
          <ActionButton
            variant="ghost"
            icon={<Target className="size-3.5" />}
            onClick={() => {
              const bundle = bundles[0]!;
              setIntake(intakeFromProductBundle(bundle));
              setShowForm(true);
            }}
          >
            Usar produto do Creator
          </ActionButton>
        )}
        {showForm && (
          <ActionButton variant="ghost" onClick={() => setShowForm(false)}>
            Fechar formulário
          </ActionButton>
        )}
      </div>

      {showForm && (
        <Panel className="border-rose-500/15">
          <PanelHeader>
            <PanelTitle className="flex items-center gap-2">
              <Megaphone className="size-3.5 text-rose-400" />
              Gerar campanha de tráfego
            </PanelTitle>
          </PanelHeader>
          <PanelContent className="space-y-3 pt-0">
            <p className="text-[11px] text-zinc-500">
              Integra Research, Creator, CopyLab, Creative Studio, Landing Builder e Launch Center.
            </p>

            <div>
              <p className="mb-2 text-[10px] font-medium uppercase tracking-wide text-zinc-500">
                Objetivo sugerido
              </p>
              <div className="flex flex-wrap gap-1.5">
                {ADS_OBJETIVOS.map((o) => (
                  <button
                    key={o.id}
                    type="button"
                    onClick={() => setIntake((c) => ({ ...c, objetivo: o.id }))}
                    className={cn(
                      "rounded-md px-2.5 py-1 text-[10px] transition-colors",
                      intake.objetivo === o.id
                        ? "bg-rose-500/20 text-rose-200"
                        : "border border-white/[0.06] text-zinc-400 hover:text-zinc-200"
                    )}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            </div>

            <AvailableBudgetField
              scope="ads"
              entityId={activeRecord?.id ?? null}
              value={intake.orcamento_disponivel}
              onChange={(value) => setIntake((c) => ({ ...c, orcamento_disponivel: value }))}
              persistOnBlur={Boolean(activeRecord?.id)}
            />

            <div>
              <p className="mb-2 text-[10px] font-medium uppercase tracking-wide text-zinc-500">
                Perfil de escala (opcional)
              </p>
              <div className="grid gap-2 sm:grid-cols-3">
                {ADS_ORCAMENTO_NIVEIS.map((n) => (
                  <button
                    key={n.id}
                    type="button"
                    onClick={() => setIntake((c) => ({ ...c, orcamento_nivel: n.id }))}
                    className={cn(
                      "rounded-md border p-2.5 text-left transition-colors",
                      intake.orcamento_nivel === n.id
                        ? "border-emerald-500/40 bg-emerald-500/10"
                        : "border-white/[0.06] hover:border-emerald-500/20"
                    )}
                  >
                    <p className="text-[11px] font-medium text-zinc-200">{n.label}</p>
                    <p className="text-[10px] text-zinc-500">{n.description}</p>
                  </button>
                ))}
              </div>
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1 block text-[10px] text-zinc-500">
                  Criativo (Creative Studio)
                </span>
                <select
                  value={intake.asset_id ?? ""}
                  onChange={(e) =>
                    setIntake((c) => ({ ...c, asset_id: e.target.value || null }))
                  }
                  className="w-full rounded-md border border-white/[0.08] bg-white/[0.03] px-2.5 py-2 text-[12px] text-zinc-100 outline-none focus:border-rose-500/40"
                >
                  <option value="">Sem criativo</option>
                  {assets.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.nome ?? "Ativo"} {a.criativo_facebook ? "· FB" : ""}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="mb-1 block text-[10px] text-zinc-500">
                  Landing (Landing Builder)
                </span>
                <select
                  value={intake.landing_id ?? ""}
                  onChange={(e) =>
                    setIntake((c) => ({ ...c, landing_id: e.target.value || null }))
                  }
                  className="w-full rounded-md border border-white/[0.08] bg-white/[0.03] px-2.5 py-2 text-[12px] text-zinc-100 outline-none focus:border-rose-500/40"
                >
                  <option value="">Sem landing</option>
                  {landings.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.nome ?? l.headline?.slice(0, 40) ?? "Landing"}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              {(
                [
                  ["nome", "Nome do produto"],
                  ["avatar", "Avatar (público)"],
                  ["problema", "Problema"],
                  ["solucao", "Solução"],
                ] as const
              ).map(([key, label]) => (
                <label key={key} className="block">
                  <span className="mb-1 block text-[10px] text-zinc-500">{label}</span>
                  <input
                    value={intake[key]}
                    onChange={(e) => setIntake((c) => ({ ...c, [key]: e.target.value }))}
                    className="w-full rounded-md border border-white/[0.08] bg-white/[0.03] px-2.5 py-2 text-[12px] text-zinc-100 outline-none focus:border-rose-500/40"
                  />
                </label>
              ))}
            </div>

            {bundles.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {bundles.slice(0, 5).map((b) => (
                  <button
                    key={b.product.id}
                    type="button"
                    onClick={() => setIntake(intakeFromProductBundle(b))}
                    className="rounded-md border border-white/[0.06] px-2 py-1 text-[10px] text-zinc-400 hover:border-rose-500/30 hover:text-rose-300"
                  >
                    {b.product.nome?.slice(0, 30) ?? "Produto"}
                  </button>
                ))}
              </div>
            )}

            <ActionButton
              disabled={busy || (!intake.nome.trim() && !intake.problema.trim())}
              icon={
                busy ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Sparkles className="size-3.5" />
                )
              }
              onClick={() => void handleGenerate()}
            >
              Gerar campanha (rascunho)
            </ActionButton>
          </PanelContent>
        </Panel>
      )}

      {activeRecord && (
        <Panel className="border-rose-500/20 bg-rose-500/[0.02]">
          <PanelHeader>
            <PanelTitle className="flex items-center gap-2">
              <DollarSign className="size-3.5 text-rose-400" />
              {activeRecord.campanha_nome ?? activeRecord.nome ?? "Campanha"}
            </PanelTitle>
          </PanelHeader>
          <PanelContent className="pt-0">
            <CampaignDetail
              record={activeRecord}
              busy={busy}
              onDelete={() =>
                void removeRecord(activeRecord.id).then((r) => {
                  if (r.error) toast.error(r.error);
                  else {
                    setActiveRecord(null);
                    toast.success("Rascunho removido.");
                  }
                })
              }
            />
          </PanelContent>
        </Panel>
      )}

      <Panel>
        <PanelHeader>
          <PanelTitle className="flex items-center gap-2">
            <Target className="size-3.5" />
            Histórico de campanhas
          </PanelTitle>
        </PanelHeader>
        <PanelContent className="space-y-2 pt-0">
          {records.length === 0 ? (
            <EmptyState
              title="Nenhuma campanha ainda"
              description="Clique em Nova campanha para gerar um plano de tráfego em rascunho."
            />
          ) : (
            records.map((record) => (
              <div
                key={record.id}
                className="rounded-md border border-white/[0.06] bg-white/[0.02]"
              >
                <button
                  type="button"
                  onClick={() => {
                    setExpandedId((id) => (id === record.id ? null : record.id));
                    setActiveRecord(record);
                  }}
                  className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left"
                >
                  <div className="min-w-0">
                    <p className="truncate text-[12px] font-medium text-zinc-200">
                      {record.campanha_nome ?? record.nome ?? "Sem título"}
                    </p>
                    <p className="text-[10px] text-zinc-500">
                      {getObjetivoLabel(record.objetivo)} ·{" "}
                      {record.investimento_mensal_previsto
                        ? formatBRL(record.investimento_mensal_previsto) + "/mês"
                        : "—"}
                      · rascunho
                    </p>
                  </div>
                  <Megaphone
                    className={cn(
                      "size-3.5 shrink-0",
                      record.campanha_nome ? "text-rose-400" : "text-zinc-600"
                    )}
                  />
                </button>
                {expandedId === record.id && (
                  <div className="border-t border-white/[0.06] px-3 py-2">
                    <CampaignDetail
                      record={record}
                      busy={busy}
                      onDelete={() =>
                        void removeRecord(record.id).then((r) => {
                          if (r.error) toast.error(r.error);
                          else {
                            if (activeRecord?.id === record.id) setActiveRecord(null);
                            toast.success("Rascunho removido.");
                          }
                        })
                      }
                    />
                  </div>
                )}
              </div>
            ))
          )}
        </PanelContent>
      </Panel>

      <Panel className="border-rose-500/10">
        <PanelHeader>
          <PanelTitle className="flex items-center gap-2">
            <Sparkles className="size-3.5 text-rose-400" />
            Ads Manager · IA
          </PanelTitle>
        </PanelHeader>
        <PanelContent className="space-y-2 pt-0">
          <div className="flex flex-wrap gap-1.5">
            {ADS_IA_ACTIONS.map((action) => (
              <button
                key={action.id}
                type="button"
                onClick={() => void sendIaMessage(action.prompt, action.id)}
                disabled={iaLoading}
                className="rounded-md border border-white/[0.06] px-2 py-1 text-[10px] text-zinc-400 hover:border-rose-500/30 hover:text-rose-300 disabled:opacity-50"
              >
                {action.label}
              </button>
            ))}
          </div>
          <div className="max-h-48 space-y-2 overflow-y-auto rounded-md border border-white/[0.04] bg-black/20 p-2">
            {iaMessages.map((m, i) => (
              <p
                key={i}
                className={cn(
                  "whitespace-pre-wrap text-[11px]",
                  m.role === "user" ? "text-rose-200" : "text-zinc-400"
                )}
              >
                {m.text}
              </p>
            ))}
          </div>
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              void sendIaMessage(iaInput);
            }}
          >
            <input
              value={iaInput}
              onChange={(e) => setIaInput(e.target.value)}
              placeholder="Crie uma campanha... Qual público usar? Quanto investir?"
              className="min-w-0 flex-1 rounded-md border border-white/[0.08] bg-white/[0.03] px-2.5 py-2 text-[12px] text-zinc-100 outline-none focus:border-rose-500/40"
            />
            <ActionButton
              type="submit"
              disabled={iaLoading || !iaInput.trim()}
              icon={
                iaLoading ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Send className="size-3.5" />
                )
              }
            >
              Enviar
            </ActionButton>
          </form>
        </PanelContent>
      </Panel>
    </div>
  );
}
