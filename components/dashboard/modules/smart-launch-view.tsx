"use client";

import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Rocket,
  Shield,
  Target,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { ActionButton } from "@/components/dashboard/action-button";
import { AvailableBudgetField } from "@/components/dashboard/available-budget-field";
import { CreatorLocaleFields } from "@/components/dashboard/creator-locale-fields";
import { EmptyState } from "@/components/dashboard/empty-state";
import { ListSkeleton, MetricsSkeleton } from "@/components/dashboard/loading-skeleton";
import { MetricCard } from "@/components/dashboard/metric-card";
import { Panel, PanelContent, PanelHeader, PanelTitle } from "@/components/dashboard/panel";
import { useSmartLaunch } from "@/hooks/use-smart-launch";
import type { AuraSmartLaunchSession } from "@/types/database";
import { formatBRL } from "@/utils/creator";
import type { CreatorLocale } from "@/utils/creator-locale";
import {
  defaultSmartLaunchIntake,
  getRiskColor,
  getRiskLabel,
  parseSmartLaunchOutputs,
  parseSmartLaunchScore,
  SMART_LAUNCH_MODULES,
  SMART_LAUNCH_PRODUCT_TYPES,
  SMART_LAUNCH_WIZARD_STEPS,
  type SmartLaunchIntake,
  type SmartLaunchProductType,
  type SmartLaunchWizardStep,
} from "@/utils/smart-launch";
import { cn } from "@/utils/cn";

function WizardStepper({
  currentStep,
  onStepClick,
}: {
  currentStep: SmartLaunchWizardStep;
  onStepClick: (step: SmartLaunchWizardStep) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {SMART_LAUNCH_WIZARD_STEPS.map(({ step, label }) => {
        const active = step === currentStep;
        const done = step < currentStep;
        return (
          <button
            key={step}
            type="button"
            onClick={() => onStepClick(step as SmartLaunchWizardStep)}
            className={cn(
              "flex items-center gap-2 rounded-md border px-3 py-2 text-[11px] font-medium transition-colors",
              active && "border-orange-500/40 bg-orange-500/10 text-orange-200",
              done && !active && "border-emerald-500/20 bg-emerald-500/[0.04] text-emerald-300",
              !active && !done && "border-white/[0.06] text-zinc-500 hover:text-zinc-300"
            )}
          >
            <span
              className={cn(
                "flex size-5 items-center justify-center rounded-full text-[10px]",
                active && "bg-orange-500/30",
                done && "bg-emerald-500/20",
                !active && !done && "bg-white/[0.04]"
              )}
            >
              {done ? <CheckCircle2 className="size-3" /> : step}
            </span>
            {label}
          </button>
        );
      })}
    </div>
  );
}

function SmartScorePanel({ session }: { session: AuraSmartLaunchSession }) {
  const score = parseSmartLaunchScore(session.smart_score);
  const outputs = parseSmartLaunchOutputs(session.generated_outputs);

  if (!score) return null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-md bg-orange-500/15 px-2 py-0.5 text-[10px] font-medium text-orange-300">
          Modo seguro — nada publicado automaticamente
        </span>
        <span className="rounded-md bg-emerald-500/15 px-2 py-0.5 text-[10px] font-medium text-emerald-300">
          Estrutura preparada
        </span>
      </div>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-md border border-emerald-500/15 bg-emerald-500/[0.04] p-3">
          <p className="text-[10px] text-emerald-400/80">Probabilidade de sucesso</p>
          <p className="text-[18px] font-semibold text-emerald-200">{score.probabilidade_sucesso}%</p>
        </div>
        <div className="rounded-md border border-white/[0.06] bg-white/[0.02] p-3">
          <p className="text-[10px] text-zinc-500">Risco</p>
          <p className={cn("text-[18px] font-semibold", getRiskColor(score.risco))}>
            {getRiskLabel(score.risco)}
          </p>
        </div>
        <div className="rounded-md border border-violet-500/15 bg-violet-500/[0.04] p-3">
          <p className="text-[10px] text-violet-400/80">ROI estimado</p>
          <p className="text-[18px] font-semibold text-violet-200">{score.roi_estimado}%</p>
        </div>
        <div className="rounded-md border border-white/[0.06] bg-white/[0.02] p-3">
          <p className="text-[10px] text-zinc-500">Tempo estimado</p>
          <p className="text-[18px] font-semibold text-zinc-200">{score.tempo_estimado_dias} dias</p>
        </div>
      </div>

      {session.resumo && (
        <div className="rounded-md border border-orange-500/15 bg-orange-500/[0.04] p-3">
          <p className="whitespace-pre-wrap text-[11px] leading-relaxed text-zinc-300">
            {session.resumo}
          </p>
        </div>
      )}

      {outputs && (
        <div className="grid gap-2 sm:grid-cols-2">
          {(
            [
              ["Produto", outputs.produto],
              ["Oferta", outputs.oferta],
              ["PDF", outputs.pdf],
              ["Landing", outputs.landing],
              ["Estratégia", outputs.estrategia],
              ["Campanha Meta", outputs.campanha_meta],
              ["Público", outputs.publico],
            ] as const
          ).map(([label, value]) => (
            <div
              key={label}
              className="rounded-md border border-white/[0.06] bg-white/[0.02] p-3"
            >
              <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-zinc-500">
                {label}
              </p>
              <p className="text-[11px] leading-relaxed text-zinc-300">{value}</p>
            </div>
          ))}
        </div>
      )}

      {outputs?.cronograma.length ? (
        <div className="space-y-2">
          <p className="text-[10px] font-medium uppercase tracking-wide text-zinc-500">Cronograma</p>
          {outputs.cronograma.slice(0, 7).map((day) => (
            <div
              key={day.dia}
              className="rounded-md border border-white/[0.06] bg-white/[0.02] px-3 py-2"
            >
              <p className="text-[11px] font-medium text-zinc-200">
                Dia {day.dia}: {day.foco}
              </p>
              <ul className="mt-1 space-y-0.5">
                {day.tarefas.slice(0, 3).map((t) => (
                  <li key={t} className="text-[10px] text-zinc-500">
                    • {t}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {session.product_id && (
          <Link
            href={`/dashboard/creator?product_id=${session.product_id}`}
            className="text-[10px] text-violet-400 hover:underline"
          >
            Ver produto →
          </Link>
        )}
        {session.landing_id && (
          <Link href="/dashboard/creator/landing" className="text-[10px] text-sky-400 hover:underline">
            Ver landing →
          </Link>
        )}
        {session.ads_campaign_id && (
          <Link href="/dashboard/creator/ads" className="text-[10px] text-rose-400 hover:underline">
            Ver campanha (rascunho) →
          </Link>
        )}
        <Link
          href="/dashboard/platforms/meta/intelligence"
          className="text-[10px] text-blue-400 hover:underline"
        >
          Meta Intelligence →
        </Link>
      </div>
    </div>
  );
}

export function SmartLaunchView() {
  const { dashboard, center, sessions, loading, error, busy, prepare, removeSession } =
    useSmartLaunch();

  const [step, setStep] = useState<SmartLaunchWizardStep>(1);
  const [intake, setIntake] = useState<SmartLaunchIntake>(defaultSmartLaunchIntake());
  const [metaFinanceira, setMetaFinanceira] = useState<number | null>(10000);
  const [orcamentoDisponivel, setOrcamentoDisponivel] = useState<number | null>(2000);

  const preparedSession =
    center?.session?.status === "prepared" ? center.session : sessions.find((s) => s.status === "prepared") ?? null;

  function updateIntake(partial: Partial<SmartLaunchIntake>) {
    setIntake((prev) => ({ ...prev, ...partial }));
  }

  function canAdvance(): boolean {
    if (step === 1) return true;
    if (step === 2) return !!intake.target_country && !!intake.currency;
    if (step === 3) {
      return (metaFinanceira ?? 0) > 0 && (orcamentoDisponivel ?? 0) > 0;
    }
    return true;
  }

  async function handlePrepare() {
    if (metaFinanceira == null || orcamentoDisponivel == null) {
      toast.error("Informe meta financeira e orçamento disponível.");
      return;
    }

    const result = await prepare({
      ...intake,
      meta_financeira: metaFinanceira,
      orcamento_disponivel: orcamentoDisponivel,
      session_id: center?.session?.id ?? null,
    });

    if (result.error) {
      toast.error(result.error);
      return;
    }

    toast.success("Lançamento preparado em modo seguro!");
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <MetricsSkeleton count={4} />
        <ListSkeleton rows={4} />
      </div>
    );
  }

  if (error) {
    return (
      <EmptyState title="Erro ao carregar" description={error} />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/[0.04] px-3 py-2">
        <Shield className="size-4 shrink-0 text-emerald-400" />
        <p className="text-[11px] text-emerald-200/90">
          <strong>Modo seguro ativo.</strong> Nenhuma campanha será publicada automaticamente — tudo
          fica em rascunho até sua aprovação manual.
        </p>
      </div>

      {dashboard && (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard
            label="Sessões"
            value={String(dashboard.sessoesTotal)}
            hint="Lançamentos preparados"
          />
          <MetricCard
            label="Melhor Smart Score"
            value={`${dashboard.melhorScore}/100`}
            hint="Maior score IA"
          />
          <MetricCard
            label="Investimento médio"
            value={dashboard.investimentoMedio > 0 ? formatBRL(dashboard.investimentoMedio) : "—"}
            hint="Por sessão"
          />
          <MetricCard
            label="Modo seguro"
            value={dashboard.modoSeguro ? "Ativo" : "—"}
            hint="Sem publicação automática"
          />
        </div>
      )}

      <Panel>
        <PanelHeader>
          <PanelTitle>Fluxo de lançamento</PanelTitle>
        </PanelHeader>
        <PanelContent className="space-y-4">
          <WizardStepper
            currentStep={step}
            onStepClick={(s) => {
              if (s <= step || preparedSession) setStep(s);
            }}
          />

          {step === 1 && (
            <div className="space-y-3">
              <p className="text-[11px] text-zinc-400">Etapa 1 — Selecione o tipo de produto</p>
              <div className="grid gap-2 sm:grid-cols-2">
                {SMART_LAUNCH_PRODUCT_TYPES.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() =>
                      updateIntake({ product_type: opt.id as SmartLaunchProductType })
                    }
                    className={cn(
                      "rounded-md border px-4 py-3 text-left transition-colors",
                      intake.product_type === opt.id
                        ? "border-orange-500/40 bg-orange-500/10"
                        : "border-white/[0.06] hover:border-white/10"
                    )}
                  >
                    <p className="text-[12px] font-medium text-zinc-200">{opt.label}</p>
                    <p className="mt-0.5 text-[10px] text-zinc-500">
                      {opt.id === "afiliado"
                        ? "Promova produtos de terceiros com estratégia de afiliação"
                        : "Crie e lance seu produto digital próprio"}
                    </p>
                  </button>
                ))}
              </div>
              <label className="block">
                <span className="mb-1 block text-[10px] text-zinc-500">Ideia ou nicho (opcional)</span>
                <input
                  value={intake.ideia ?? ""}
                  onChange={(e) => updateIntake({ ideia: e.target.value })}
                  placeholder="Ex: curso de produtividade para freelancers"
                  className="w-full rounded-md border border-white/[0.08] bg-white/[0.03] px-2.5 py-2 text-[12px] text-zinc-100 outline-none focus:border-orange-500/40"
                />
              </label>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-3">
              <p className="text-[11px] text-zinc-400">Etapa 2 — País, idioma e moeda</p>
              <CreatorLocaleFields
                value={intake}
                onChange={(locale: CreatorLocale) =>
                  updateIntake({
                    target_country: locale.target_country,
                    target_language: locale.target_language,
                    currency: locale.currency,
                  })
                }
              />
            </div>
          )}

          {step === 3 && (
            <div className="space-y-3">
              <p className="text-[11px] text-zinc-400">Etapa 3 — Meta financeira e orçamento</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-1 block text-[10px] text-zinc-500">Meta financeira *</span>
                  <input
                    type="number"
                    min={0}
                    value={metaFinanceira ?? ""}
                    onChange={(e) =>
                      setMetaFinanceira(e.target.value ? Number(e.target.value) : null)
                    }
                    className="w-full rounded-md border border-white/[0.08] bg-white/[0.03] px-2.5 py-2 text-[12px] text-zinc-100 outline-none focus:border-orange-500/40"
                  />
                </label>
                <AvailableBudgetField
                  value={orcamentoDisponivel}
                  onChange={setOrcamentoDisponivel}
                />
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-3">
              <p className="text-[11px] text-zinc-400">
                Etapa 4 — A IA utilizará todos os módulos para gerar o lançamento
              </p>
              <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
                {SMART_LAUNCH_MODULES.map((mod) => (
                  <div
                    key={mod.id}
                    className="flex items-center gap-2 rounded-md border border-white/[0.06] bg-white/[0.02] px-3 py-2"
                  >
                    <CheckCircle2 className="size-3.5 shrink-0 text-orange-400/70" />
                    <span className="text-[11px] text-zinc-300">{mod.label}</span>
                  </div>
                ))}
              </div>
              <div className="rounded-md border border-white/[0.06] bg-white/[0.02] p-3 text-[11px] text-zinc-400">
                <p className="font-medium text-zinc-300">Será gerado:</p>
                <p className="mt-1">
                  Produto · Oferta · PDF · Landing · Estratégia · Campanha Meta (rascunho) · Público ·
                  Cronograma
                </p>
              </div>
              <ActionButton
                onClick={() => void handlePrepare()}
                disabled={busy}
                className="w-full sm:w-auto"
              >
                {busy ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Preparando lançamento…
                  </>
                ) : (
                  <>
                    <Rocket className="size-4" />
                    Preparar Lançamento
                  </>
                )}
              </ActionButton>
            </div>
          )}

          <div className="flex items-center justify-between gap-2 border-t border-white/[0.06] pt-3">
            <button
              type="button"
              disabled={step <= 1}
              onClick={() => setStep((s) => Math.max(1, s - 1) as SmartLaunchWizardStep)}
              className="flex items-center gap-1 rounded-md px-2 py-1.5 text-[11px] text-zinc-400 hover:text-zinc-200 disabled:opacity-40"
            >
              <ChevronLeft className="size-3.5" />
              Voltar
            </button>
            {step < 4 && (
              <button
                type="button"
                disabled={!canAdvance()}
                onClick={() => setStep((s) => Math.min(4, s + 1) as SmartLaunchWizardStep)}
                className="flex items-center gap-1 rounded-md bg-orange-500/20 px-3 py-1.5 text-[11px] font-medium text-orange-200 hover:bg-orange-500/30 disabled:opacity-40"
              >
                Próximo
                <ChevronRight className="size-3.5" />
              </button>
            )}
          </div>
        </PanelContent>
      </Panel>

      {preparedSession && (
        <Panel>
          <PanelHeader className="flex items-center justify-between">
            <PanelTitle className="flex items-center gap-2">
              <Target className="size-4 text-orange-400" />
              Smart Score
            </PanelTitle>
            <button
              type="button"
              disabled={busy}
              onClick={async () => {
                const { error: delError } = await removeSession(preparedSession.id);
                if (delError) toast.error(delError);
                else toast.success("Sessão removida.");
              }}
              className="text-zinc-500 hover:text-rose-400"
            >
              <Trash2 className="size-3.5" />
            </button>
          </PanelHeader>
          <PanelContent>
            <SmartScorePanel session={preparedSession} />
          </PanelContent>
        </Panel>
      )}

      {sessions.length > 1 && (
        <Panel>
          <PanelHeader>
            <PanelTitle>Histórico de lançamentos</PanelTitle>
          </PanelHeader>
          <PanelContent className="space-y-2">
            {sessions.slice(0, 5).map((s) => {
              const score = parseSmartLaunchScore(s.smart_score);
              return (
                <div
                  key={s.id}
                  className="flex items-center justify-between gap-2 rounded-md border border-white/[0.06] px-3 py-2"
                >
                  <div>
                    <p className="text-[11px] text-zinc-300">
                      {s.product_type === "afiliado" ? "Afiliado" : "Próprio"} · {s.target_country}
                    </p>
                    <p className="text-[10px] text-zinc-500">{s.resumo?.slice(0, 80) ?? s.status}</p>
                  </div>
                  <div className="flex items-center gap-2 text-[10px]">
                    {score && (
                      <span className="text-violet-300">{score.score_geral}/100</span>
                    )}
                    <span
                      className={cn(
                        s.status === "prepared" && "text-emerald-400",
                        s.status === "preparing" && "text-amber-400",
                        s.status === "failed" && "text-rose-400"
                      )}
                    >
                      {s.status}
                    </span>
                  </div>
                </div>
              );
            })}
          </PanelContent>
        </Panel>
      )}
    </div>
  );
}
