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
  Wand2,
  Layers,
  Maximize2,
  Crown,
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
import type { ProductComplianceCheck, ProductFactoryType } from "@/types/database";
import { parseJsonResponse } from "@/utils/safe-json";
import {
  generateProductFactoryPdf,
  pdfBytesToBase64,
} from "@/utils/product-factory-pdf";
import {
  buildProductFactoryDownloadUrl,
  complianceStatusColor,
  complianceStatusLabel,
  FACTORY_INTEGRATIONS,
  factoryStatusLabel,
  intakeFromProductBundle,
  parseDesign,
  parseJsonArray,
  PRODUCT_FACTORY_IA_ACTIONS,
  PRODUCT_FACTORY_TYPES,
  STORAGE_BUCKET_WARNING,
  type ProductFactoryBundle,
  type ProductFactoryChapter,
  type ProductFactoryChecklistItem,
  type ProductFactoryComplianceItem,
  type ProductFactoryExercise,
  type ProductFactoryIntake,
  productTypeLabel,
  versionLabelText,
} from "@/utils/product-factory";
import type { ProductFactoryProAction } from "@/utils/product-factory-pro";
import {
  computeProductQualityScore,
  parseProContent,
  PRODUCT_NOT_READY_MESSAGE,
  PRODUCT_NOT_READY_PDF_MESSAGE,
  PRODUCT_QUALITY_MIN_SCORE,
} from "@/utils/product-factory-pro";
import { cn } from "@/utils/cn";

function QualityScorePanel({ bundle }: { bundle: ProductFactoryBundle }) {
  const pro = parseProContent(bundle.factory.conteudo);
  const quality = computeProductQualityScore(bundle.factory, bundle.compliance);
  const score = quality.score;
  const ready = quality.readyToSell;
  const issues = quality.issues;
  const persistedScore = pro.quality_score;

  return (
    <div
      className={cn(
        "rounded-md border p-3",
        ready
          ? "border-emerald-500/20 bg-emerald-500/[0.04]"
          : "border-amber-500/20 bg-amber-500/[0.04]"
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[11px] font-medium text-zinc-200">Product Quality Score</p>
        <span
          className={cn(
            "rounded-md px-2 py-0.5 text-[11px] font-semibold",
            score >= PRODUCT_QUALITY_MIN_SCORE
              ? "bg-emerald-500/15 text-emerald-300"
              : "bg-amber-500/15 text-amber-300"
          )}
        >
          {score}/100
        </span>
      </div>
      <p className="mt-1 text-[10px] text-zinc-500">
        ~{quality.estimatedPages} páginas estimadas · mínimo {PRODUCT_QUALITY_MIN_SCORE} para vender
        {persistedScore != null && persistedScore !== score
          ? ` · histórico persistido: ${persistedScore}`
          : ""}
      </p>
      {!ready && (
        <p className="mt-2 text-[11px] text-amber-200">{PRODUCT_NOT_READY_MESSAGE}</p>
      )}
      {issues.length > 0 && (
        <ul className="mt-2 list-inside list-disc text-[10px] text-zinc-500">
          {issues.slice(0, 4).map((issue) => (
            <li key={issue}>{issue}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

const EMPTY_INTAKE: ProductFactoryIntake = {
  titulo: "",
  subtitulo: "",
  promessa: "",
  avatar: "",
  publico: "",
  objetivo: "",
  problema: "",
  solucao: "",
  product_type: "ebook",
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
  onPublishPremiumPdf,
  onRunCompliance,
  onProAction,
  busy,
}: {
  bundle: ProductFactoryBundle;
  onDelete: () => void;
  onPublishPdf: () => void;
  onPublishPremiumPdf: () => void;
  onRunCompliance: () => void;
  onProAction: (action: ProductFactoryProAction) => void;
  busy: boolean;
}) {
  const { factory, latestPdf, compliance, versions } = bundle;
  const [tab, setTab] = useState<DetailTab>("conteudo");
  const design = parseDesign(factory.design);
  const chapters = parseJsonArray<ProductFactoryChapter>(factory.capitulos);
  const exercises = parseJsonArray<ProductFactoryExercise>(factory.exercicios);
  const checklist = parseJsonArray<ProductFactoryChecklistItem>(factory.checklist);
  const pro = parseProContent(factory.conteudo);
  const quality = computeProductQualityScore(factory, compliance);
  const readyToSell = quality.readyToSell;
  const liveIssues = quality.issues;

  return (
    <div className="space-y-3 text-[12px]">
      <QualityScorePanel bundle={bundle} />
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-md bg-violet-500/15 px-2 py-0.5 text-[10px] text-violet-300">
          {factoryStatusLabel(factory.status)}
        </span>
        <span className="rounded-md bg-white/[0.04] px-2 py-0.5 text-[10px] text-zinc-400">
          {productTypeLabel(factory.product_type)}
        </span>
        <span className="text-[10px] text-zinc-500">
          {versionLabelText(
            versions[0]?.version_label ??
              (factory.current_version <= 1
                ? "rascunho"
                : factory.current_version === 2
                  ? "revisado"
                  : "final")
          )}
        </span>
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

          {(pro.faqs?.length ?? 0) > 0 && (
            <div>
              <p className="mb-2 text-[10px] uppercase tracking-wide text-amber-400">
                Perguntas frequentes (FAQ)
              </p>
              <div className="space-y-2">
                {pro.faqs!.map((faq) => (
                  <div
                    key={faq.pergunta}
                    className="rounded-md border border-white/[0.06] bg-white/[0.02] p-3"
                  >
                    <p className="font-medium text-zinc-200">{faq.pergunta}</p>
                    <p className="mt-1 text-zinc-400">{faq.resposta}</p>
                  </div>
                ))}
              </div>
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
                  <span className="font-medium text-zinc-200">
                    {versionLabelText(v.version_label ?? undefined) || `v${v.version_number}`}
                  </span>
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
        {!readyToSell && (
          <p className="w-full text-[10px] text-amber-200">
            {liveIssues.length > 0
              ? liveIssues.slice(0, 3).join(" · ")
              : PRODUCT_NOT_READY_PDF_MESSAGE}
          </p>
        )}
        <ActionButton onClick={() => onProAction("improve")} disabled={busy} className="gap-1.5">
          {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Wand2 className="h-3 w-3" />}
          Melhorar Produto
        </ActionButton>
        <ActionButton
          variant="ghost"
          onClick={() => onProAction("regenerate_design")}
          disabled={busy}
          className="gap-1.5"
        >
          <Palette className="h-3 w-3" />
          Regenerar Design
        </ActionButton>
        <ActionButton
          variant="ghost"
          onClick={() => onProAction("expand_content")}
          disabled={busy}
          className="gap-1.5"
        >
          <Maximize2 className="h-3 w-3" />
          Expandir Conteúdo
        </ActionButton>
        <ActionButton
          variant="ghost"
          onClick={() => onProAction("premium")}
          disabled={busy}
          className="gap-1.5"
        >
          <Crown className="h-3 w-3" />
          Gerar Versão Premium
        </ActionButton>
        <ActionButton
          onClick={onPublishPdf}
          disabled={busy || !readyToSell}
          className="gap-1.5"
        >
          {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Download className="h-3 w-3" />}
          {latestPdf ? "Atualizar PDF" : "Gerar PDF"}
        </ActionButton>
        <ActionButton
          onClick={onPublishPremiumPdf}
          disabled={busy || !readyToSell}
          className="gap-1.5"
        >
          {busy ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <Layers className="h-3 w-3" />
          )}
          Baixar PDF Premium
        </ActionButton>
        {latestPdf?.id && readyToSell && (
          <a
            href={buildProductFactoryDownloadUrl(latestPdf.id)}
            download={latestPdf.file_name ?? "ebook.pdf"}
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
  const {
    bundles,
    dashboard,
    storageReady,
    loading,
    error,
    busy,
    generate,
    publishPdf,
    runProAction,
    runCompliance,
    removeRecord,
  } = useProductFactory();
  const { bundles: creatorBundles } = useCreator();
  const [intake, setIntake] = useState<ProductFactoryIntake>(EMPTY_INTAKE);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [iaMessages, setIaMessages] = useState<{ role: "user" | "assistant"; text: string }[]>(
    []
  );
  const [iaInput, setIaInput] = useState("");
  const [iaLoading, setIaLoading] = useState(false);

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
      toast.success("Produto Pro V1 gerado com sucesso!");
    }
  }

  async function handlePublishPdf(bundle: ProductFactoryBundle, premium = false) {
    try {
      const bytes = await generateProductFactoryPdf(bundle.factory, { premium });
      console.info("[ebook] pdf generated", {
        factoryId: bundle.factory.id,
        bytes: bytes.length,
        premium,
      });
      const base64 = pdfBytesToBase64(bytes);
      const { file, error: pdfError } = await publishPdf(bundle.factory.id, base64, premium);
      if (pdfError) {
        const liveQuality = computeProductQualityScore(bundle.factory, bundle.compliance);
        toast.error(
          pdfError,
          liveQuality.issues.length
            ? { description: liveQuality.issues.slice(0, 3).join(" · ") }
            : undefined
        );
        return;
      }
      if (file?.id) {
        toast.success(
          premium ? "PDF Premium publicado! Use Baixar PDF." : "PDF publicado! Use o botão Baixar PDF."
        );
      }
    } catch {
      toast.error("Erro ao gerar PDF.");
    }
  }

  async function handleProAction(factoryId: string, action: ProductFactoryProAction) {
    const labels: Record<ProductFactoryProAction, string> = {
      improve: "Produto melhorado",
      regenerate_design: "Design regenerado",
      expand_content: "Conteúdo expandido",
      premium: "Versão Premium gerada",
    };

    console.info("[product-pro] UI handleProAction", { factoryId, action });

    const { bundle, error: proError } = await runProAction(factoryId, action);
    if (proError) {
      console.error("[product-pro] UI toast error", { factoryId, action, proError });
      toast.error(proError);
      return;
    }
    if (bundle) {
      setSelectedId(bundle.factory.id);
      const liveQuality = computeProductQualityScore(bundle.factory, bundle.compliance);
      if (!liveQuality.readyToSell && liveQuality.issues.length > 0) {
        toast.warning(labels[action], {
          description: liveQuality.issues.slice(0, 3).join(" · "),
        });
        return;
      }
      toast.success(labels[action]);
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
          module: "factory",
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
      {!storageReady && (
        <Panel className="border-amber-500/20 bg-amber-500/[0.04]">
          <PanelContent className="py-3 text-[12px] text-amber-200">
            {STORAGE_BUCKET_WARNING}
          </PanelContent>
        </Panel>
      )}

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
          <div>
            <label className="text-[10px] uppercase tracking-wide text-zinc-600">
              Tipo de produto
            </label>
            <select
              value={intake.product_type ?? "ebook"}
              onChange={(e) =>
                setIntake((prev) => ({
                  ...prev,
                  product_type: e.target.value as ProductFactoryType,
                }))
              }
              className="mt-1 w-full rounded-md border border-white/[0.06] bg-white/[0.02] px-2 py-1.5 text-[12px] text-zinc-200"
            >
              {PRODUCT_FACTORY_TYPES.map((type) => (
                <option key={type.id} value={type.id}>
                  {type.label}
                </option>
              ))}
            </select>
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            {(
              [
                ["titulo", "Título"],
                ["subtitulo", "Subtítulo"],
                ["promessa", "Promessa"],
                ["avatar", "Avatar"],
                ["publico", "Público"],
                ["objetivo", "Objetivo"],
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
              Gerar e-book Pro V1 + design + compliance
            </ActionButton>
            {PRODUCT_FACTORY_IA_ACTIONS.map((action) => (
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
        </PanelContent>
      </Panel>

      <Panel>
        <PanelHeader>
          <PanelTitle className="flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-violet-400" />
            Aura IA — Product Factory
          </PanelTitle>
        </PanelHeader>
        <PanelContent className="space-y-2">
          {iaMessages.length > 0 && (
            <div className="max-h-48 space-y-2 overflow-y-auto rounded-md border border-white/[0.06] bg-white/[0.02] p-2">
              {iaMessages.map((msg, i) => (
                <div
                  key={`${msg.role}-${i}`}
                  className={cn(
                    "rounded-md px-2 py-1.5 text-[11px]",
                    msg.role === "user"
                      ? "bg-violet-500/10 text-violet-100"
                      : "text-zinc-300"
                  )}
                >
                  {msg.text}
                </div>
              ))}
            </div>
          )}
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
              placeholder="Pergunte sobre e-books, PDF, compliance..."
              disabled={iaLoading}
              className="flex-1 rounded-md border border-white/[0.06] bg-white/[0.02] px-2 py-1.5 text-[12px] text-zinc-200 outline-none focus:border-violet-500/40"
            />
            <ActionButton type="submit" disabled={iaLoading || !iaInput.trim()}>
              {iaLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Enviar"}
            </ActionButton>
          </form>
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
                onPublishPdf={() => void handlePublishPdf(selected, false)}
                onPublishPremiumPdf={() => void handlePublishPdf(selected, true)}
                onProAction={(action) => void handleProAction(selected.factory.id, action)}
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
