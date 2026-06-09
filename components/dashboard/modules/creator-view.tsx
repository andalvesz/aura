"use client";

import {
  CheckCircle2,
  Loader2,
  Plus,
  Rocket,
  Send,
  Sparkles,
  Target,
  Trash2,
  TrendingUp,
  Wand2,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { ActionButton } from "@/components/dashboard/action-button";
import { EmptyState } from "@/components/dashboard/empty-state";
import { ListSkeleton, MetricsSkeleton } from "@/components/dashboard/loading-skeleton";
import { MetricCard } from "@/components/dashboard/metric-card";
import { Panel, PanelContent, PanelHeader, PanelTitle } from "@/components/dashboard/panel";
import { useCreator } from "@/hooks/use-creator";
import {
  CREATOR_IA_ACTIONS,
  CREATOR_NICHE_SUGGESTIONS,
  formatBRL,
  parseBulletPoints,
  type CreatorProductBundle,
  type CreatorProductIntake,
} from "@/utils/creator";
import { parseJsonResponse } from "@/utils/safe-json";
import { cn } from "@/utils/cn";

type WizardStep = "idle" | "intake" | "product" | "validation" | "offer";

const EMPTY_INTAKE: CreatorProductIntake = {
  nicho: "",
  conhecimento: "",
  publico_alvo: "",
  objetivo_financeiro: null,
  prazo: "",
};

function ScoreBar({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="mb-1 flex justify-between text-[11px]">
        <span className="text-zinc-400">{label}</span>
        <span className="font-medium text-zinc-200">{value}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
        <div
          className="h-full rounded-full bg-violet-400 transition-all"
          style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
        />
      </div>
    </div>
  );
}

function ProductDetail({ bundle }: { bundle: CreatorProductBundle }) {
  const { product, validation, offer } = bundle;
  const bullets = parseBulletPoints(offer?.bullet_points);

  return (
    <div className="space-y-3 text-[12px]">
      <div className="grid gap-2 sm:grid-cols-2">
        <div>
          <p className="text-[10px] uppercase tracking-wide text-zinc-600">Problema</p>
          <p className="text-zinc-300">{product.problema ?? "—"}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wide text-zinc-600">Solução</p>
          <p className="text-zinc-300">{product.solucao ?? "—"}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wide text-zinc-600">Avatar</p>
          <p className="text-zinc-300">{product.avatar ?? "—"}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wide text-zinc-600">Público-alvo</p>
          <p className="text-zinc-300">{product.publico_alvo ?? "—"}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wide text-zinc-600">Promessa</p>
          <p className="text-zinc-300">{product.promessa ?? "—"}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wide text-zinc-600">Mecanismo único</p>
          <p className="text-zinc-300">{product.mecanismo_unico ?? "—"}</p>
        </div>
      </div>

      <div>
        <p className="text-[10px] uppercase tracking-wide text-zinc-600">Diferenciais</p>
        <p className="text-zinc-300">{product.diferenciais ?? "—"}</p>
      </div>

      <div className="flex flex-wrap gap-3 text-[11px] text-zinc-400">
        <span>
          Preço: {formatBRL(product.faixa_preco_min)} – {formatBRL(product.faixa_preco_max)}
        </span>
        <span>Formato: {product.formato ?? "—"}</span>
        <span>Prob. venda: {product.probabilidade_venda ?? "—"}%</span>
      </div>

      {validation && (
        <div className="space-y-2 rounded-md border border-violet-500/15 bg-violet-500/[0.04] p-3">
          <p className="text-[11px] font-medium text-violet-300">
            Validação · Nota {validation.nota_final}/100
          </p>
          <ScoreBar label="Demanda" value={validation.demanda} />
          <ScoreBar label="Concorrência" value={validation.concorrencia} />
          <ScoreBar label="Facilidade de criação" value={validation.facilidade_criacao} />
          <ScoreBar label="Facilidade de venda" value={validation.facilidade_venda} />
          <ScoreBar label="Escalabilidade" value={validation.escalabilidade} />
        </div>
      )}

      {offer && (
        <div className="space-y-2 rounded-md border border-emerald-500/15 bg-emerald-500/[0.04] p-3">
          <p className="text-[13px] font-semibold text-zinc-100">{offer.headline}</p>
          {offer.subheadline && (
            <p className="text-[12px] text-zinc-400">{offer.subheadline}</p>
          )}
          {bullets.length > 0 && (
            <ul className="list-inside list-disc space-y-0.5 text-[11px] text-zinc-300">
              {bullets.map((b) => (
                <li key={b}>{b}</li>
              ))}
            </ul>
          )}
          {offer.garantia && (
            <p className="text-[11px] text-zinc-400">
              <span className="text-zinc-500">Garantia:</span> {offer.garantia}
            </p>
          )}
          {offer.bonus && (
            <p className="text-[11px] text-zinc-400">
              <span className="text-zinc-500">Bônus:</span> {offer.bonus}
            </p>
          )}
          {offer.cta && (
            <p className="text-[12px] font-medium text-emerald-300">{offer.cta}</p>
          )}
        </div>
      )}
    </div>
  );
}

export function CreatorView() {
  const {
    dashboard,
    bundles,
    loading,
    error,
    busy,
    refresh,
    generateProduct,
    validateProduct,
    generateOffer,
    removeProduct,
  } = useCreator();

  const [step, setStep] = useState<WizardStep>("idle");
  const [intake, setIntake] = useState<CreatorProductIntake>(EMPTY_INTAKE);
  const [activeBundle, setActiveBundle] = useState<CreatorProductBundle | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const [iaInput, setIaInput] = useState("");
  const [iaLoading, setIaLoading] = useState(false);
  const [iaMessages, setIaMessages] = useState<{ role: "user" | "assistant"; text: string }[]>([
    {
      role: "assistant",
      text: "Sou a Aura Creator — ajudo a criar, validar e lançar produtos digitais com base na sua trajetória e dados da Aura.",
    },
  ]);

  async function handleGenerate(useAuraData: boolean) {
    const { bundle, error: genError } = await generateProduct({ intake, useAuraData });
    if (genError || !bundle) {
      toast.error(genError ?? "Erro ao gerar produto.");
      return;
    }
    setActiveBundle(bundle);
    setStep("product");
    toast.success("Produto gerado pela IA.");
  }

  async function handleValidate() {
    if (!activeBundle) return;
    const { bundle, error: valError } = await validateProduct(activeBundle.product.id);
    if (valError || !bundle) {
      toast.error(valError ?? "Erro na validação.");
      return;
    }
    setActiveBundle(bundle);
    setStep("validation");
    toast.success(`Validação concluída · ${bundle.validation?.nota_final}/100`);
  }

  async function handleOffer() {
    if (!activeBundle) return;
    const { bundle, error: offerError } = await generateOffer(activeBundle.product.id);
    if (offerError || !bundle) {
      toast.error(offerError ?? "Erro ao gerar oferta.");
      return;
    }
    setActiveBundle(bundle);
    setStep("offer");
    toast.success("Oferta gerada.");
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
          { role: "assistant", text: body?.error ?? parseError ?? "Erro na IA Creator." },
        ]);
        return;
      }

      setIaMessages((c) => [
        ...c,
        { role: "assistant", text: body?.text ?? "Sem resposta." },
      ]);
    } catch {
      setIaMessages((c) => [
        ...c,
        { role: "assistant", text: "Erro de conexão com a IA Creator." },
      ]);
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
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Produtos criados"
          value={String(dashboard?.produtosCriados ?? 0)}
          hint="Total no Creator"
        />
        <MetricCard
          label="Produtos validados"
          value={String(dashboard?.produtosValidados ?? 0)}
          hint="Com score IA"
        />
        <MetricCard
          label="Melhor oportunidade"
          value={dashboard?.melhorOportunidade ?? "—"}
          hint="Maior nota de validação"
        />
        <MetricCard
          label="Potencial estimado"
          value={formatBRL(dashboard?.potencialEstimado ?? 0)}
          hint="Soma dos lançamentos"
        />
      </div>

      <div className="flex flex-wrap gap-2">
        <ActionButton
          icon={<Plus className="size-3.5" />}
          onClick={() => {
            setStep("intake");
            setIntake(EMPTY_INTAKE);
            setActiveBundle(null);
          }}
        >
          Criar Produto
        </ActionButton>
        {step !== "idle" && (
          <ActionButton
            variant="ghost"
            onClick={() => {
              setStep("idle");
              setActiveBundle(null);
            }}
          >
            Fechar assistente
          </ActionButton>
        )}
      </div>

      {step === "intake" && (
        <Panel className="border-violet-500/15">
          <PanelHeader>
            <PanelTitle className="flex items-center gap-2">
              <Wand2 className="size-3.5 text-violet-400" />
              Novo produto digital
            </PanelTitle>
          </PanelHeader>
          <PanelContent className="space-y-3 pt-0">
            <p className="text-[11px] text-zinc-500">
              A IA vai perguntar sobre nicho, conhecimento, público, objetivo financeiro e prazo.
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              {(
                [
                  ["nicho", "Nicho"],
                  ["conhecimento", "Seu conhecimento"],
                  ["publico_alvo", "Público-alvo"],
                  ["prazo", "Prazo"],
                ] as const
              ).map(([key, label]) => (
                <label key={key} className="block">
                  <span className="mb-1 block text-[10px] text-zinc-500">{label}</span>
                  <input
                    value={intake[key]}
                    onChange={(e) => setIntake((c) => ({ ...c, [key]: e.target.value }))}
                    className="w-full rounded-md border border-white/[0.08] bg-white/[0.03] px-2.5 py-2 text-[12px] text-zinc-100 outline-none focus:border-violet-500/40"
                  />
                </label>
              ))}
              <label className="block sm:col-span-2">
                <span className="mb-1 block text-[10px] text-zinc-500">
                  Objetivo financeiro (R$)
                </span>
                <input
                  type="number"
                  min={0}
                  value={intake.objetivo_financeiro ?? ""}
                  onChange={(e) =>
                    setIntake((c) => ({
                      ...c,
                      objetivo_financeiro: e.target.value ? Number(e.target.value) : null,
                    }))
                  }
                  className="w-full rounded-md border border-white/[0.08] bg-white/[0.03] px-2.5 py-2 text-[12px] text-zinc-100 outline-none focus:border-violet-500/40"
                />
              </label>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {CREATOR_NICHE_SUGGESTIONS.map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setIntake((c) => ({ ...c, nicho: n }))}
                  className="rounded-md border border-white/[0.06] px-2 py-1 text-[10px] text-zinc-400 hover:border-violet-500/30 hover:text-violet-300"
                >
                  {n}
                </button>
              ))}
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              <ActionButton
                disabled={busy}
                icon={busy ? <Loader2 className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5" />}
                onClick={() => void handleGenerate(false)}
              >
                Gerar com IA
              </ActionButton>
              <ActionButton
                variant="ghost"
                disabled={busy}
                onClick={() => void handleGenerate(true)}
              >
                Use meus dados da Aura
              </ActionButton>
            </div>
          </PanelContent>
        </Panel>
      )}

      {activeBundle && step !== "idle" && step !== "intake" && (
        <Panel className="border-violet-500/20 bg-violet-500/[0.02]">
          <PanelHeader className="items-start">
            <div>
              <PanelTitle>{activeBundle.product.nome ?? "Produto"}</PanelTitle>
              <p className="mt-0.5 text-[11px] capitalize text-zinc-500">
                Status: {activeBundle.product.status}
              </p>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {step === "product" && (
                <ActionButton
                  disabled={busy}
                  icon={busy ? <Loader2 className="size-3.5 animate-spin" /> : <Target className="size-3.5" />}
                  onClick={() => void handleValidate()}
                >
                  Validar
                </ActionButton>
              )}
              {(step === "validation" || step === "product") && activeBundle.validation && (
                <ActionButton
                  disabled={busy}
                  icon={busy ? <Loader2 className="size-3.5 animate-spin" /> : <Rocket className="size-3.5" />}
                  onClick={() => void handleOffer()}
                >
                  Gerar oferta
                </ActionButton>
              )}
              {step === "offer" && (
                <span className="inline-flex items-center gap-1 text-[11px] text-emerald-400">
                  <CheckCircle2 className="size-3.5" />
                  Oferta pronta
                </span>
              )}
            </div>
          </PanelHeader>
          <PanelContent className="pt-0">
            <ProductDetail bundle={activeBundle} />
          </PanelContent>
        </Panel>
      )}

      <Panel>
        <PanelHeader>
          <PanelTitle>Produtos</PanelTitle>
        </PanelHeader>
        <PanelContent className="space-y-2 pt-0">
          {bundles.length === 0 ? (
            <EmptyState
              title="Nenhum produto ainda"
              description='Clique em "Criar Produto" para começar.'
            />
          ) : (
            bundles.map((bundle) => (
              <div
                key={bundle.product.id}
                className="rounded-md border border-white/[0.06] bg-white/[0.02]"
              >
                <button
                  type="button"
                  onClick={() =>
                    setExpandedId((id) =>
                      id === bundle.product.id ? null : bundle.product.id
                    )
                  }
                  className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left"
                >
                  <div className="min-w-0">
                    <p className="truncate text-[12px] font-medium text-zinc-200">
                      {bundle.product.nome ?? "Sem nome"}
                    </p>
                    <p className="text-[10px] text-zinc-500">
                      {bundle.product.formato ?? "—"}
                      {bundle.validation
                        ? ` · ${bundle.validation.nota_final}/100`
                        : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        void removeProduct(bundle.product.id).then((r) => {
                          if (r.error) toast.error(r.error);
                          else toast.success("Produto removido.");
                        });
                      }}
                      className="rounded p-1 text-zinc-600 hover:bg-rose-500/10 hover:text-rose-400"
                      aria-label="Excluir produto"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                    <TrendingUp
                      className={cn(
                        "size-3.5 shrink-0",
                        bundle.validation && bundle.validation.nota_final >= 70
                          ? "text-emerald-400"
                          : "text-zinc-600"
                      )}
                    />
                  </div>
                </button>
                {expandedId === bundle.product.id && (
                  <div className="border-t border-white/[0.06] px-3 py-2">
                    <ProductDetail bundle={bundle} />
                  </div>
                )}
              </div>
            ))
          )}
        </PanelContent>
      </Panel>

      <Panel className="border-violet-500/10">
        <PanelHeader>
          <PanelTitle className="flex items-center gap-2">
            <Sparkles className="size-3.5 text-violet-400" />
            Aura Creator · IA
          </PanelTitle>
        </PanelHeader>
        <PanelContent className="space-y-2 pt-0">
          <div className="flex flex-wrap gap-1.5">
            {CREATOR_IA_ACTIONS.map((action) => (
              <button
                key={action.id}
                type="button"
                onClick={() => void sendIaMessage(action.prompt, action.id)}
                disabled={iaLoading}
                className="rounded-md border border-white/[0.06] px-2 py-1 text-[10px] text-zinc-400 hover:border-violet-500/30 hover:text-violet-300 disabled:opacity-50"
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
                  m.role === "user" ? "text-violet-200" : "text-zinc-400"
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
              placeholder="Pergunte sobre produtos, nichos ou lançamentos..."
              className="min-w-0 flex-1 rounded-md border border-white/[0.08] bg-white/[0.03] px-2.5 py-2 text-[12px] text-zinc-100 outline-none focus:border-violet-500/40"
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
