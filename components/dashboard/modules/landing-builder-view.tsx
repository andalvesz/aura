"use client";

import {
  Globe,
  LayoutTemplate,
  Loader2,
  Monitor,
  Send,
  Smartphone,
  Sparkles,
  Tablet,
  Trash2,
  Wand2,
} from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ActionButton } from "@/components/dashboard/action-button";
import { CreatorLocaleFields, DEFAULT_CREATOR_LOCALE } from "@/components/dashboard/creator-locale-fields";
import { EmptyState } from "@/components/dashboard/empty-state";
import { ListSkeleton, MetricsSkeleton } from "@/components/dashboard/loading-skeleton";
import { MetricCard } from "@/components/dashboard/metric-card";
import { Panel, PanelContent, PanelHeader, PanelTitle } from "@/components/dashboard/panel";
import { useCreator } from "@/hooks/use-creator";
import { useLandingBuilder } from "@/hooks/use-landing-builder";
import type { CreatorLanding, LandingModelo } from "@/types/database";
import { cn } from "@/utils/cn";
import {
  formatBRL,
  getModeloLabel,
  intakeFromProductBundle,
  LANDING_IA_ACTIONS,
  LANDING_MODELS,
  parseDepoimentos,
  parseFaq,
  type LandingGenerateKind,
  type LandingIntake,
} from "@/utils/landing-builder";
import { parseJsonStringArray } from "@/utils/research";
import { parseJsonResponse } from "@/utils/safe-json";

type PreviewDevice = "desktop" | "tablet" | "mobile";

const PREVIEW_WIDTHS: Record<PreviewDevice, string> = {
  desktop: "100%",
  tablet: "768px",
  mobile: "375px",
};

const EMPTY_INTAKE: LandingIntake = {
  nome: "",
  avatar: "",
  problema: "",
  solucao: "",
  promessa: "",
  diferencial: "",
  preco: null,
  product_id: null,
  copylab_id: null,
  modelo: "pagina_simples",
  ...DEFAULT_CREATOR_LOCALE,
};

function LandingPreview({
  record,
  device,
}: {
  record: CreatorLanding;
  device: PreviewDevice;
}) {
  const beneficios = parseJsonStringArray(record.beneficios);
  const depoimentos = parseDepoimentos(record.depoimentos);
  const faq = parseFaq(record.faq);

  return (
    <div className="flex justify-center overflow-x-auto rounded-lg border border-white/[0.08] bg-zinc-900/50 p-4">
      <div
        className="overflow-hidden rounded-lg bg-white shadow-2xl transition-all duration-300"
        style={{ width: PREVIEW_WIDTHS[device], maxWidth: "100%", minHeight: "480px" }}
      >
        {/* Hero */}
        <section className="bg-gradient-to-br from-violet-600 to-indigo-700 px-6 py-10 text-white">
          {record.hero_section && (
            <p className="mb-3 text-[10px] uppercase tracking-wider text-violet-200/80">
              {record.hero_section.slice(0, 80)}
              {record.hero_section.length > 80 ? "…" : ""}
            </p>
          )}
          <h1 className="text-xl font-bold leading-tight sm:text-2xl">
            {record.headline ?? "Headline da landing"}
          </h1>
          {record.subheadline && (
            <p className="mt-3 text-sm text-violet-100/90">{record.subheadline}</p>
          )}
          {record.cta && (
            <button
              type="button"
              className="mt-6 rounded-lg bg-white px-5 py-2.5 text-sm font-semibold text-violet-700 shadow-lg"
            >
              {record.cta.split("\n")[0]?.slice(0, 40) ?? "Quero começar agora"}
            </button>
          )}
        </section>

        {/* Benefícios */}
        {beneficios.length > 0 && (
          <section className="px-6 py-8">
            <h2 className="mb-4 text-center text-lg font-semibold text-zinc-800">
              O que você vai conquistar
            </h2>
            <ul className="space-y-2">
              {beneficios.map((b, i) => (
                <li key={i} className="flex gap-2 text-sm text-zinc-600">
                  <span className="text-emerald-500">✓</span>
                  {b}
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Problema */}
        {record.section_problema && (
          <section className="bg-red-50 px-6 py-8">
            <h2 className="mb-3 text-lg font-semibold text-red-900">O problema</h2>
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-red-800/80">
              {record.section_problema}
            </p>
          </section>
        )}

        {/* Solução */}
        {record.section_solucao && (
          <section className="px-6 py-8">
            <h2 className="mb-3 text-lg font-semibold text-zinc-800">A solução</h2>
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-zinc-600">
              {record.section_solucao}
            </p>
          </section>
        )}

        {/* Depoimentos */}
        {depoimentos.length > 0 && (
          <section className="bg-zinc-50 px-6 py-8">
            <h2 className="mb-4 text-center text-lg font-semibold text-zinc-800">
              Depoimentos
            </h2>
            <div className="space-y-3">
              {depoimentos.map((d, i) => (
                <blockquote
                  key={i}
                  className="rounded-lg border border-zinc-200 bg-white p-4 text-sm"
                >
                  <p className="text-zinc-600">&ldquo;{d.texto}&rdquo;</p>
                  <footer className="mt-2 text-xs font-medium text-zinc-800">
                    — {d.nome}
                    {d.resultado ? ` · ${d.resultado}` : ""}
                  </footer>
                </blockquote>
              ))}
            </div>
          </section>
        )}

        {/* Bônus + Garantia */}
        {(record.bonus || record.garantia) && (
          <section className="px-6 py-8">
            {record.bonus && (
              <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-4">
                <h3 className="mb-2 text-sm font-semibold text-amber-900">Bônus exclusivos</h3>
                <p className="whitespace-pre-wrap text-sm text-amber-800/80">{record.bonus}</p>
              </div>
            )}
            {record.garantia && (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
                <h3 className="mb-2 text-sm font-semibold text-emerald-900">Garantia</h3>
                <p className="whitespace-pre-wrap text-sm text-emerald-800/80">{record.garantia}</p>
              </div>
            )}
          </section>
        )}

        {/* FAQ */}
        {faq.length > 0 && (
          <section className="bg-zinc-50 px-6 py-8">
            <h2 className="mb-4 text-center text-lg font-semibold text-zinc-800">FAQ</h2>
            <div className="space-y-3">
              {faq.map((f, i) => (
                <div key={i} className="rounded-lg border border-zinc-200 bg-white p-3">
                  <p className="text-sm font-medium text-zinc-800">{f.pergunta}</p>
                  <p className="mt-1 text-sm text-zinc-600">{f.resposta}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* CTA final */}
        {record.cta && (
          <section className="bg-violet-600 px-6 py-8 text-center text-white">
            <button
              type="button"
              className="rounded-lg bg-white px-6 py-3 text-sm font-semibold text-violet-700 shadow-lg"
            >
              {record.cta.split("\n")[0]?.slice(0, 50) ?? "Garantir minha vaga"}
            </button>
          </section>
        )}

        {/* Rodapé */}
        {record.rodape && (
          <footer className="border-t border-zinc-200 px-6 py-4 text-center text-[10px] text-zinc-500">
            <p className="whitespace-pre-wrap">{record.rodape}</p>
          </footer>
        )}
      </div>
    </div>
  );
}

export function LandingBuilderView() {
  const searchParams = useSearchParams();
  const { bundles } = useCreator();
  const { dashboard, records, loading, error, busy, refresh, generate, removeRecord } =
    useLandingBuilder();

  const [intake, setIntake] = useState<LandingIntake>(EMPTY_INTAKE);
  const [activeRecord, setActiveRecord] = useState<CreatorLanding | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [previewDevice, setPreviewDevice] = useState<PreviewDevice>("desktop");

  const [iaInput, setIaInput] = useState("");
  const [iaLoading, setIaLoading] = useState(false);
  const [iaMessages, setIaMessages] = useState<{ role: "user" | "assistant"; text: string }[]>([
    {
      role: "assistant",
      text: "Sou a Aura Landing Builder — gero páginas de vendas completas a partir dos seus dados.",
    },
  ]);

  const previewRecord = activeRecord ?? records[0] ?? null;

  useEffect(() => {
    const productId = searchParams.get("product_id");
    const nome = searchParams.get("nome");
    const problema = searchParams.get("problema");

    if (productId) {
      const bundle = bundles.find((b) => b.product.id === productId);
      if (bundle) {
        setIntake(intakeFromProductBundle(bundle));
        setShowForm(true);
        return;
      }
    }

    if (nome || problema) {
      setIntake({
        nome: nome ?? "",
        avatar: searchParams.get("avatar") ?? "",
        problema: problema ?? "",
        solucao: searchParams.get("solucao") ?? "",
        promessa: searchParams.get("promessa") ?? "",
        diferencial: searchParams.get("diferencial") ?? "",
        preco: searchParams.get("preco") ? Number(searchParams.get("preco")) : null,
        product_id: productId,
        copylab_id: null,
        modelo: "pagina_simples",
      });
      setShowForm(true);
    }
  }, [searchParams, bundles]);

  async function handleGenerate(kind: LandingGenerateKind) {
    const payload: LandingIntake = {
      ...intake,
      landing_id: activeRecord?.id ?? intake.landing_id,
    };
    const { record, error: genError } = await generate(payload, kind);
    if (genError || !record) {
      toast.error(genError ?? "Erro ao gerar landing.");
      return;
    }
    setActiveRecord(record);
    setShowForm(false);
    toast.success(
      kind === "improve"
        ? "Landing melhorada!"
        : kind === "optimize"
          ? "Landing otimizada!"
          : "Landing gerada com sucesso!"
    );
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
          module: "landing",
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
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Landings geradas"
          value={String(dashboard?.totalLandings ?? 0)}
          hint="Total no builder"
        />
        <MetricCard
          label="Último produto"
          value={dashboard?.ultimoProduto ?? "—"}
          hint="Nome da última landing"
        />
        <MetricCard
          label="Com FAQ"
          value={String(dashboard?.comFaq ?? 0)}
          hint="Páginas com FAQ"
        />
        <MetricCard
          label="Modelos usados"
          value={String(dashboard?.modelosUsados ?? 0)}
          hint="Tipos de página"
        />
      </div>

      <div className="flex flex-wrap gap-2">
        <ActionButton
          icon={<LayoutTemplate className="size-3.5" />}
          onClick={() => {
            setShowForm(true);
            setIntake(EMPTY_INTAKE);
            setActiveRecord(null);
          }}
        >
          Nova landing
        </ActionButton>
        {bundles.length > 0 && (
          <ActionButton
            variant="ghost"
            icon={<Globe className="size-3.5" />}
            onClick={() => {
              const bundle = bundles[0]!;
              setIntake(intakeFromProductBundle(bundle));
              setShowForm(true);
            }}
          >
            Usar produto do Creator
          </ActionButton>
        )}
        {activeRecord && (
          <>
            <ActionButton
              variant="ghost"
              disabled={busy}
              icon={<Wand2 className="size-3.5" />}
              onClick={() => void handleGenerate("improve")}
            >
              Melhorar página
            </ActionButton>
            <ActionButton
              variant="ghost"
              disabled={busy}
              icon={<Sparkles className="size-3.5" />}
              onClick={() => void handleGenerate("optimize")}
            >
              Otimizar conversão
            </ActionButton>
          </>
        )}
        {showForm && (
          <ActionButton variant="ghost" onClick={() => setShowForm(false)}>
            Fechar formulário
          </ActionButton>
        )}
      </div>

      {showForm && (
        <Panel className="border-sky-500/15">
          <PanelHeader>
            <PanelTitle className="flex items-center gap-2">
              <LayoutTemplate className="size-3.5 text-sky-400" />
              Gerar landing page
            </PanelTitle>
          </PanelHeader>
          <PanelContent className="space-y-3 pt-0">
            <p className="text-[11px] text-zinc-500">
              Usa dados do Creator, Research, CopyLab, Creative Studio e Launch Center.
            </p>

            <CreatorLocaleFields
              value={intake}
              onChange={(next) => setIntake((c) => ({ ...c, ...next }))}
            />

            <div>
              <p className="mb-2 text-[10px] font-medium uppercase tracking-wide text-zinc-500">
                Modelo
              </p>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {LANDING_MODELS.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setIntake((c) => ({ ...c, modelo: m.id }))}
                    className={cn(
                      "rounded-md border p-2.5 text-left transition-colors",
                      intake.modelo === m.id
                        ? "border-sky-500/40 bg-sky-500/10"
                        : "border-white/[0.06] hover:border-sky-500/20"
                    )}
                  >
                    <p className="text-[11px] font-medium text-zinc-200">{m.label}</p>
                    <p className="mt-0.5 text-[10px] text-zinc-500">{m.description}</p>
                  </button>
                ))}
              </div>
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              {(
                [
                  ["nome", "Nome do produto"],
                  ["avatar", "Avatar (público)"],
                  ["problema", "Problema"],
                  ["solucao", "Solução"],
                  ["promessa", "Promessa"],
                  ["diferencial", "Diferencial"],
                ] as const
              ).map(([key, label]) => (
                <label key={key} className="block">
                  <span className="mb-1 block text-[10px] text-zinc-500">{label}</span>
                  <input
                    value={intake[key]}
                    onChange={(e) => setIntake((c) => ({ ...c, [key]: e.target.value }))}
                    className="w-full rounded-md border border-white/[0.08] bg-white/[0.03] px-2.5 py-2 text-[12px] text-zinc-100 outline-none focus:border-sky-500/40"
                  />
                </label>
              ))}
              <label className="block">
                <span className="mb-1 block text-[10px] text-zinc-500">
                  Preço ({intake.currency ?? DEFAULT_CREATOR_LOCALE.currency})
                </span>
                <input
                  type="number"
                  min={0}
                  value={intake.preco ?? ""}
                  onChange={(e) =>
                    setIntake((c) => ({
                      ...c,
                      preco: e.target.value ? Number(e.target.value) : null,
                    }))
                  }
                  className="w-full rounded-md border border-white/[0.08] bg-white/[0.03] px-2.5 py-2 text-[12px] text-zinc-100 outline-none focus:border-sky-500/40"
                />
              </label>
            </div>

            {bundles.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {bundles.slice(0, 5).map((b) => (
                  <button
                    key={b.product.id}
                    type="button"
                    onClick={() =>
                      setIntake(intakeFromProductBundle(b, intake.modelo as LandingModelo))
                    }
                    className="rounded-md border border-white/[0.06] px-2 py-1 text-[10px] text-zinc-400 hover:border-sky-500/30 hover:text-sky-300"
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
              onClick={() => void handleGenerate("generate")}
            >
              Gerar landing
            </ActionButton>
          </PanelContent>
        </Panel>
      )}

      {previewRecord && (
        <Panel className="border-sky-500/20 bg-sky-500/[0.02]">
          <PanelHeader>
            <div className="flex w-full flex-wrap items-center justify-between gap-2">
              <PanelTitle>
                Preview · {previewRecord.nome ?? previewRecord.headline?.slice(0, 40) ?? "Landing"}
                {previewRecord.preco != null && (
                  <span className="ml-2 text-[10px] font-normal text-emerald-400">
                    {formatBRL(previewRecord.preco)}
                  </span>
                )}
              </PanelTitle>
              <div className="flex items-center gap-1">
                {(
                  [
                    ["desktop", Monitor],
                    ["tablet", Tablet],
                    ["mobile", Smartphone],
                  ] as const
                ).map(([device, Icon]) => (
                  <button
                    key={device}
                    type="button"
                    onClick={() => setPreviewDevice(device)}
                    className={cn(
                      "rounded-md p-1.5 transition-colors",
                      previewDevice === device
                        ? "bg-sky-500/20 text-sky-200"
                        : "text-zinc-500 hover:text-zinc-300"
                    )}
                    title={device}
                  >
                    <Icon className="size-3.5" />
                  </button>
                ))}
              </div>
            </div>
            <p className="text-[10px] text-zinc-500">
              Modelo: {getModeloLabel(previewRecord.modelo)}
              {previewRecord.product_id && (
                <>
                  {" · "}
                  <Link href="/dashboard/creator" className="text-sky-400 hover:underline">
                    Produto vinculado
                  </Link>
                </>
              )}
            </p>
          </PanelHeader>
          <PanelContent className="pt-0">
            <LandingPreview record={previewRecord} device={previewDevice} />
          </PanelContent>
        </Panel>
      )}

      <Panel>
        <PanelHeader>
          <PanelTitle className="flex items-center gap-2">
            <Globe className="size-3.5" />
            Histórico de landings
          </PanelTitle>
        </PanelHeader>
        <PanelContent className="space-y-2 pt-0">
          {records.length === 0 ? (
            <EmptyState
              title="Nenhuma landing ainda"
              description='Clique em "Nova landing" para gerar sua primeira página de vendas.'
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
                      {record.nome ?? record.headline?.slice(0, 60) ?? "Sem título"}
                    </p>
                    <p className="text-[10px] text-zinc-500">
                      {getModeloLabel(record.modelo)} · {record.headline?.slice(0, 60) ?? "—"}
                    </p>
                  </div>
                  <LayoutTemplate
                    className={cn(
                      "size-3.5 shrink-0",
                      record.headline ? "text-sky-400" : "text-zinc-600"
                    )}
                  />
                </button>
                {expandedId === record.id && (
                  <div className="border-t border-white/[0.06] px-3 py-2">
                    <div className="mb-2 flex flex-wrap gap-2">
                      <ActionButton
                        variant="ghost"
                        disabled={busy}
                        onClick={() => {
                          setActiveRecord(record);
                          setIntake({
                            nome: record.nome ?? "",
                            avatar: record.avatar ?? "",
                            problema: record.problema ?? "",
                            solucao: record.solucao ?? "",
                            promessa: record.promessa ?? "",
                            diferencial: record.diferencial ?? "",
                            preco: record.preco,
                            product_id: record.product_id,
                            copylab_id: record.copylab_id,
                            landing_id: record.id,
                            modelo: record.modelo,
                          });
                          void handleGenerate("improve");
                        }}
                      >
                        Melhorar
                      </ActionButton>
                      <ActionButton
                        variant="ghost"
                        disabled={busy}
                        icon={<Trash2 className="size-3.5" />}
                        onClick={() =>
                          void removeRecord(record.id).then((r) => {
                            if (r.error) toast.error(r.error);
                            else {
                              if (activeRecord?.id === record.id) setActiveRecord(null);
                              toast.success("Landing removida.");
                            }
                          })
                        }
                      >
                        Excluir
                      </ActionButton>
                    </div>
                    <LandingPreview record={record} device="mobile" />
                  </div>
                )}
              </div>
            ))
          )}
        </PanelContent>
      </Panel>

      <Panel className="border-sky-500/10">
        <PanelHeader>
          <PanelTitle className="flex items-center gap-2">
            <Sparkles className="size-3.5 text-sky-400" />
            Landing Builder · IA
          </PanelTitle>
        </PanelHeader>
        <PanelContent className="space-y-2 pt-0">
          <div className="flex flex-wrap gap-1.5">
            {LANDING_IA_ACTIONS.map((action) => (
              <button
                key={action.id}
                type="button"
                onClick={() => void sendIaMessage(action.prompt, action.id)}
                disabled={iaLoading}
                className="rounded-md border border-white/[0.06] px-2 py-1 text-[10px] text-zinc-400 hover:border-sky-500/30 hover:text-sky-300 disabled:opacity-50"
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
                  m.role === "user" ? "text-sky-200" : "text-zinc-400"
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
              placeholder="Crie uma landing... Melhore essa página... Otimize a conversão..."
              className="min-w-0 flex-1 rounded-md border border-white/[0.08] bg-white/[0.03] px-2.5 py-2 text-[12px] text-zinc-100 outline-none focus:border-sky-500/40"
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
