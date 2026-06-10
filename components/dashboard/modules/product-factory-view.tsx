"use client";

import {
  BookOpen,
  Download,
  ExternalLink,
  FileText,
  Loader2,
  Palette,
  ShieldCheck,
  Sparkles,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ActionButton } from "@/components/dashboard/action-button";
import { EmptyState } from "@/components/dashboard/empty-state";
import { ListSkeleton, MetricsSkeleton } from "@/components/dashboard/loading-skeleton";
import { MetricCard } from "@/components/dashboard/metric-card";
import { Panel, PanelContent, PanelHeader, PanelTitle } from "@/components/dashboard/panel";
import { useCreator } from "@/hooks/use-creator";
import { useProductFactory } from "@/hooks/use-product-factory";
import type { ProductComplianceCheck } from "@/types/database";
import {
  generateProductFactoryPdf,
  pdfBytesToBase64,
} from "@/utils/product-factory-pdf";
import {
  complianceStatusColor,
  complianceStatusLabel,
  FACTORY_INTEGRATIONS,
  factoryStatusLabel,
  intakeFromProductBundle,
  parseDesign,
  parseJsonArray,
  PRODUCT_FACTORY_IA_ACTIONS,
  type ProductFactoryBundle,
  type ProductFactoryChapter,
  type ProductFactoryChecklistItem,
  type ProductFactoryComplianceItem,
  type ProductFactoryExercise,
  type ProductFactoryIntake,
} from "@/utils/product-factory";
import { cn } from "@/utils/cn";

const EMPTY_INTAKE: ProductFactoryIntake = {
  titulo: "",
  promessa: "",
  avatar: "",
  problema: "",
  solucao: "",
  product_id: null,
};

type DetailTab = "conteudo" | "design" | "compliance" | "versoes";

const DETAIL_TABS: { id: DetailTab; label: string }[] = [
  { id: "conteudo", label: "Conteúdo" },
  { id: "design", label: "Design" },
  { id: "compliance", label: "Compliance" },
  { id: "versoes", label: "Versões" },
];

function CompliancePanel({ compliance }: { compliance: ProductComplianceCheck | null }) {
  if (!compliance) {
    return <p className="text-zinc-500">Nenhuma análise de compliance registrada.</p>;
  }

  const forbidden = parseJsonArray<string>(compliance.forbidden_claims);
  const misleading = parseJsonArray<string>(compliance.misleading_risks);
  const checklist = parseJsonArray<ProductFactoryComplianceItem>(compliance.ad_checklist);
  const recommendations = parseJsonArray<string>(compliance.recommendations);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={cn(
            "rounded-md px-2 py-0.5 text-[10px] font-medium",
            complianceStatusColor(compliance.status)
          )}
        >
          {complianceStatusLabel(compliance.status)}
        </span>
        {compliance.risk_score != null && (
          <span className="text-[10px] text-zinc-500">
            Risco: {compliance.risk_score}/100 ({compliance.risk_level ?? "—"})
          </span>
        )}
      </div>

      {compliance.notes && (
        <p className="rounded-md border border-white/[0.06] bg-white/[0.02] p-2 text-zinc-300">
          {compliance.notes}
        </p>
      )}

      {forbidden.length > 0 && (
        <div>
          <p className="text-[10px] uppercase tracking-wide text-rose-400">Claims proibidas</p>
          <ul className="mt-1 list-inside list-disc text-zinc-400">
            {forbidden.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      )}

      {misleading.length > 0 && (
        <div>
          <p className="text-[10px] uppercase tracking-wide text-amber-400">
            Promessas enganosas
          </p>
          <ul className="mt-1 list-inside list-disc text-zinc-400">
            {misleading.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      )}

      {checklist.length > 0 && (
        <div>
          <p className="text-[10px] uppercase tracking-wide text-violet-400">
            Checklist para anúncios
          </p>
          <div className="mt-2 space-y-1">
            {checklist.map((item) => (
              <div
                key={item.item}
                className="rounded-md border border-white/[0.06] bg-white/[0.02] p-2"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium text-zinc-200">{item.item}</span>
                  <span
                    className={cn(
                      "text-[10px]",
                      item.status === "ok"
                        ? "text-emerald-400"
                        : item.status === "bloqueado"
                          ? "text-rose-400"
                          : "text-amber-400"
                    )}
                  >
                    {item.status}
                  </span>
                </div>
                <p className="mt-1 text-zinc-500">{item.nota}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {recommendations.length > 0 && (
        <div>
          <p className="text-[10px] uppercase tracking-wide text-sky-400">Recomendações</p>
          <ul className="mt-1 list-inside list-disc text-zinc-400">
            {recommendations.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function FactoryDetail({
  bundle,
  onDelete,
  onPublishPdf,
  onRunCompliance,
  busy,
}: {
  bundle: ProductFactoryBundle;
  onDelete: () => void;
  onPublishPdf: () => void;
  onRunCompliance: () => void;
  busy: boolean;
}) {
  const { factory, latestPdf, compliance, versions } = bundle;
  const [tab, setTab] = useState<DetailTab>("conteudo");
  const design = parseDesign(factory.design);
  const chapters = parseJsonArray<ProductFactoryChapter>(factory.capitulos);
  const exercises = parseJsonArray<ProductFactoryExercise>(factory.exercicios);
  const checklist = parseJsonArray<ProductFactoryChecklistItem>(factory.checklist);

  return (
    <div className="space-y-3 text-[12px]">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-md bg-violet-500/15 px-2 py-0.5 text-[10px] text-violet-300">
          {factoryStatusLabel(factory.status)}
        </span>
        <span className="text-[10px] text-zinc-500">v{factory.current_version}</span>
        {factory.product_id && (
          <Link
            href="/dashboard/creator"
            className="text-[10px] text-violet-400 hover:underline"
          >
            Produto no Creator →
          </Link>
        )}
      </div>

      <div>
        <p className="text-[14px] font-semibold text-zinc-100">{factory.titulo ?? "—"}</p>
        <p className="mt-1 text-zinc-400">{factory.promessa ?? "—"}</p>
      </div>

      <div className="flex flex-wrap gap-1">
        {DETAIL_TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={cn(
              "rounded-md px-2 py-1 text-[10px] transition-colors",
              tab === t.id
                ? "bg-violet-500/20 text-violet-200"
                : "border border-white/[0.06] text-zinc-500 hover:text-zinc-300"
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "conteudo" && (
        <div className="space-y-3">
          {chapters.map((chapter) => (
            <div
              key={chapter.titulo}
              className="rounded-md border border-white/[0.06] bg-white/[0.02] p-3"
            >
              <p className="font-semibold text-zinc-200">{chapter.titulo}</p>
              {chapter.resumo && <p className="mt-1 text-zinc-500">{chapter.resumo}</p>}
              <p className="mt-2 whitespace-pre-wrap text-zinc-300">{chapter.conteudo}</p>
            </div>
          ))}

          {exercises.length > 0 && (
            <div>
              <p className="mb-2 text-[10px] uppercase tracking-wide text-violet-400">
                Exercícios
              </p>
              {exercises.map((ex) => (
                <div
                  key={ex.titulo}
                  className="mb-2 rounded-md border border-white/[0.06] p-2"
                >
                  <p className="font-medium text-zinc-200">{ex.titulo}</p>
                  <p className="text-zinc-400">{ex.instrucao}</p>
                  {ex.reflexao && (
                    <p className="mt-1 text-zinc-500">Reflexão: {ex.reflexao}</p>
                  )}
                </div>
              ))}
            </div>
          )}

          {factory.bonus && (
            <div className="rounded-md border border-emerald-500/20 bg-emerald-500/[0.04] p-3">
              <p className="text-[10px] uppercase tracking-wide text-emerald-400">Bônus</p>
              <p className="mt-1 text-zinc-300">{factory.bonus}</p>
            </div>
          )}

          {checklist.length > 0 && (
            <div>
              <p className="mb-2 text-[10px] uppercase tracking-wide text-sky-400">Checklist</p>
              <ul className="space-y-1">
                {checklist.map((item) => (
                  <li key={item.item} className="text-zinc-400">
                    <span className="text-zinc-200">{item.item}</span> — {item.descricao}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {factory.conclusao && (
            <div className="rounded-md border border-white/[0.06] p-3">
              <p className="text-[10px] uppercase tracking-wide text-zinc-500">Conclusão</p>
              <p className="mt-1 text-zinc-300">{factory.conclusao}</p>
            </div>
          )}
        </div>
      )}

      {tab === "design" && (
        <div className="space-y-3 rounded-md border border-fuchsia-500/15 bg-fuchsia-500/[0.04] p-3">
          <div>
            <p className="text-[10px] uppercase tracking-wide text-fuchsia-400">Capa</p>
            <p className="text-zinc-300">{design.capa || "—"}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wide text-fuchsia-400">Paleta</p>
            <div className="mt-1 flex flex-wrap gap-2">
              {design.paleta.length > 0 ? (
                design.paleta.map((color) => (
                  <span
                    key={color}
                    className="flex items-center gap-1 rounded-md border border-white/[0.06] px-2 py-0.5 text-[10px]"
                  >
                    <span
                      className="inline-block h-3 w-3 rounded-full border border-white/20"
                      style={{ backgroundColor: color }}
                    />
                    {color}
                  </span>
                ))
              ) : (
                <span className="text-zinc-500">—</span>
              )}
            </div>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wide text-fuchsia-400">Estilo visual</p>
            <p className="text-zinc-300">{design.estilo_visual || "—"}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wide text-fuchsia-400">
              Páginas internas
            </p>
            <p className="whitespace-pre-wrap text-zinc-300">{design.paginas_internas || "—"}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wide text-fuchsia-400">Mockup textual</p>
            <p className="whitespace-pre-wrap text-zinc-300">{design.mockup_textual || "—"}</p>
          </div>
        </div>
      )}

      {tab === "compliance" && <CompliancePanel compliance={compliance} />}

      {tab === "versoes" && (
        <div className="space-y-2">
          {versions.length === 0 ? (
            <p className="text-zinc-500">Nenhuma versão registrada.</p>
          ) : (
            versions.map((v) => (
              <div
                key={v.id}
                className="rounded-md border border-white/[0.06] bg-white/[0.02] p-2"
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium text-zinc-200">v{v.version_number}</span>
                  <span className="text-[10px] text-zinc-600">
                    {new Date(v.created_at).toLocaleDateString("pt-BR")}
                  </span>
                </div>
                <p className="mt-1 text-zinc-500">{v.changelog ?? "—"}</p>
              </div>
            ))
          )}
        </div>
      )}

      <div className="flex flex-wrap gap-2 border-t border-white/[0.06] pt-3">
        <ActionButton
          onClick={onPublishPdf}
          disabled={busy}
          className="gap-1.5"
        >
          {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Download className="h-3 w-3" />}
          {latestPdf ? "Atualizar PDF" : "Gerar PDF"}
        </ActionButton>
        {latestPdf?.file_url && (
          <a
            href={latestPdf.file_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-[11px] font-medium text-emerald-300 hover:bg-emerald-500/20"
          >
            <ExternalLink className="h-3 w-3" />
            Baixar PDF
          </a>
        )}
        <ActionButton
          variant="ghost"
          onClick={onRunCompliance}
          disabled={busy}
          className="gap-1.5"
        >
          <ShieldCheck className="h-3 w-3" />
          Revisar compliance
        </ActionButton>
        <ActionButton
          variant="ghost"
          onClick={onDelete}
          disabled={busy}
          className="gap-1.5 text-rose-400 hover:text-rose-300"
        >
          <Trash2 className="h-3 w-3" />
          Excluir
        </ActionButton>
      </div>
    </div>
  );
}

export function ProductFactoryView() {
  const searchParams = useSearchParams();
  const { bundles, dashboard, loading, error, busy, generate, publishPdf, runCompliance, removeRecord } =
    useProductFactory();
  const { bundles: creatorBundles } = useCreator();
  const [intake, setIntake] = useState<ProductFactoryIntake>(EMPTY_INTAKE);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const selected = bundles.find((b) => b.factory.id === selectedId) ?? bundles[0] ?? null;

  useEffect(() => {
    const productId = searchParams.get("product_id");
    if (!productId || !creatorBundles.length) return;
    const bundle = creatorBundles.find((b) => b.product.id === productId);
    if (bundle) {
      setIntake(intakeFromProductBundle(bundle));
    }
  }, [searchParams, creatorBundles]);

  useEffect(() => {
    if (selected && !selectedId) {
      setSelectedId(selected.factory.id);
    }
  }, [selected, selectedId]);

  async function handleGenerate() {
    const { bundle, error: genError } = await generate(intake);
    if (genError) {
      toast.error(genError);
      return;
    }
    if (bundle) {
      setSelectedId(bundle.factory.id);
      toast.success("E-book gerado com sucesso!");
    }
  }

  async function handlePublishPdf(bundle: ProductFactoryBundle) {
    try {
      const bytes = await generateProductFactoryPdf(bundle.factory);
      const base64 = pdfBytesToBase64(bytes);
      const { file, error: pdfError } = await publishPdf(bundle.factory.id, base64);
      if (pdfError) {
        toast.error(pdfError);
        return;
      }
      if (file?.file_url) {
        toast.success("PDF publicado! Use o botão Baixar PDF.");
      }
    } catch {
      toast.error("Erro ao gerar PDF.");
    }
  }

  async function handleCompliance(factoryId: string) {
    const { error: compError } = await runCompliance(factoryId);
    if (compError) {
      toast.error(compError);
      return;
    }
    toast.success("Compliance revisado.");
  }

  async function handleDelete(id: string) {
    const { error: delError } = await removeRecord(id);
    if (delError) {
      toast.error(delError);
      return;
    }
    setSelectedId(null);
    toast.success("Produto excluído.");
  }

  if (loading) {
    return (
      <div className="space-y-3">
        <MetricsSkeleton count={4} />
        <ListSkeleton rows={4} />
      </div>
    );
  }

  if (error) {
    return (
      <EmptyState
        title="Erro ao carregar"
        description={error}
      />
    );
  }

  return (
    <div className="space-y-3">
      {dashboard && (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard label="Produtos" value={String(dashboard.totalProducts)} />
          <MetricCard label="Com PDF" value={String(dashboard.withPdf)} />
          <MetricCard label="Compliance OK" value={String(dashboard.compliancePass)} />
          <MetricCard label="Último" value={dashboard.ultimoTitulo} />
        </div>
      )}

      <Panel>
        <PanelHeader>
          <PanelTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-violet-400" />
            Criar e-book completo
          </PanelTitle>
        </PanelHeader>
        <PanelContent className="space-y-3">
          <div className="grid gap-2 sm:grid-cols-2">
            {(
              [
                ["titulo", "Título"],
                ["promessa", "Promessa"],
                ["avatar", "Avatar"],
                ["problema", "Problema"],
                ["solucao", "Solução"],
              ] as const
            ).map(([key, label]) => (
              <div key={key}>
                <label className="text-[10px] uppercase tracking-wide text-zinc-600">{label}</label>
                <input
                  value={intake[key]}
                  onChange={(e) => setIntake((prev) => ({ ...prev, [key]: e.target.value }))}
                  className="mt-1 w-full rounded-md border border-white/[0.06] bg-white/[0.02] px-2 py-1.5 text-[12px] text-zinc-200 outline-none focus:border-violet-500/40"
                />
              </div>
            ))}
          </div>

          {creatorBundles.length > 0 && (
            <div>
              <label className="text-[10px] uppercase tracking-wide text-zinc-600">
                Vincular produto Creator
              </label>
              <select
                value={intake.product_id ?? ""}
                onChange={(e) => {
                  const id = e.target.value || null;
                  if (!id) {
                    setIntake((prev) => ({ ...prev, product_id: null }));
                    return;
                  }
                  const bundle = creatorBundles.find((b) => b.product.id === id);
                  if (bundle) setIntake(intakeFromProductBundle(bundle));
                }}
                className="mt-1 w-full rounded-md border border-white/[0.06] bg-white/[0.02] px-2 py-1.5 text-[12px] text-zinc-200"
              >
                <option value="">Nenhum</option>
                {creatorBundles.map((b) => (
                  <option key={b.product.id} value={b.product.id}>
                    {b.product.nome ?? "Produto sem nome"}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <ActionButton onClick={() => void handleGenerate()} disabled={busy} className="gap-1.5">
              {busy ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Sparkles className="h-3.5 w-3.5" />
              )}
              Gerar e-book + design + compliance
            </ActionButton>
            {PRODUCT_FACTORY_IA_ACTIONS.map((action) => (
              <span
                key={action.id}
                className="rounded-md border border-white/[0.06] px-2 py-1 text-[10px] text-zinc-600"
              >
                {action.label}
              </span>
            ))}
          </div>
        </PanelContent>
      </Panel>

      <Panel>
        <PanelHeader>
          <PanelTitle className="flex items-center gap-2">
            <ExternalLink className="h-4 w-4 text-sky-400" />
            Integrações Aura
          </PanelTitle>
        </PanelHeader>
        <PanelContent>
          <div className="flex flex-wrap gap-2">
            {FACTORY_INTEGRATIONS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="rounded-md border border-white/[0.06] px-2 py-1 text-[10px] text-zinc-400 hover:border-violet-500/30 hover:text-violet-300"
              >
                {link.label}
              </Link>
            ))}
          </div>
        </PanelContent>
      </Panel>

      <div className="grid gap-3 lg:grid-cols-[240px_1fr]">
        <Panel>
          <PanelHeader>
            <PanelTitle>Produtos</PanelTitle>
          </PanelHeader>
          <PanelContent className="space-y-1">
            {bundles.length === 0 ? (
              <p className="text-[11px] text-zinc-500">Nenhum produto criado ainda.</p>
            ) : (
              bundles.map((b) => (
                <button
                  key={b.factory.id}
                  type="button"
                  onClick={() => setSelectedId(b.factory.id)}
                  className={cn(
                    "w-full rounded-md px-2 py-2 text-left text-[11px] transition-colors",
                    selected?.factory.id === b.factory.id
                      ? "bg-violet-500/20 text-violet-200"
                      : "text-zinc-400 hover:bg-white/[0.04]"
                  )}
                >
                  <p className="truncate font-medium">{b.factory.titulo ?? "Sem título"}</p>
                  <div className="mt-0.5 flex items-center gap-2 text-[10px] text-zinc-600">
                    <span>{factoryStatusLabel(b.factory.status)}</span>
                    {b.latestPdf && <FileText className="h-3 w-3 text-emerald-500" />}
                    {b.compliance?.status === "pass" && (
                      <ShieldCheck className="h-3 w-3 text-emerald-500" />
                    )}
                  </div>
                </button>
              ))
            )}
          </PanelContent>
        </Panel>

        <Panel>
          <PanelHeader>
            <PanelTitle className="flex items-center gap-2">
              <Palette className="h-4 w-4 text-fuchsia-400" />
              Detalhes do produto
            </PanelTitle>
          </PanelHeader>
          <PanelContent>
            {selected ? (
              <FactoryDetail
                bundle={selected}
                busy={busy}
                onDelete={() => void handleDelete(selected.factory.id)}
                onPublishPdf={() => void handlePublishPdf(selected)}
                onRunCompliance={() => void handleCompliance(selected.factory.id)}
              />
            ) : (
              <EmptyState
                title="Nenhum produto selecionado"
                description="Gere seu primeiro e-book completo com a Aura Product Factory."
              />
            )}
          </PanelContent>
        </Panel>
      </div>
    </div>
  );
}
