"use client";

import {
  Clapperboard,
  Image,
  Loader2,
  Palette,
  Send,
  Sparkles,
  Trash2,
  Video,
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
import { useCreativeStudio } from "@/hooks/use-creative-studio";
import { useCreator } from "@/hooks/use-creator";
import type { CreatorAsset } from "@/types/database";
import { cn } from "@/utils/cn";
import {
  intakeFromProductBundle,
  STUDIO_IA_ACTIONS,
  type StudioGenerateKind,
  type StudioIntake,
} from "@/utils/creative-studio";
import { parseJsonStringArray } from "@/utils/research";
import { parseJsonResponse } from "@/utils/safe-json";

const EMPTY_INTAKE: StudioIntake = {
  nome: "",
  avatar: "",
  problema: "",
  solucao: "",
  promessa: "",
  diferencial: "",
  preco: null,
  product_id: null,
  copylab_id: null,
  ...DEFAULT_CREATOR_LOCALE,
};

type AssetTab = "imagens" | "videos" | "social";

const SECTION_TABS: { id: AssetTab; label: string }[] = [
  { id: "imagens", label: "Imagens" },
  { id: "videos", label: "Vídeos" },
  { id: "social", label: "Social" },
];

const GENERATE_ACTIONS: { kind: StudioGenerateKind; label: string }[] = [
  { kind: "criativo", label: "Gerar Criativo" },
  { kind: "roteiro", label: "Gerar Roteiro" },
  { kind: "carrossel", label: "Gerar Carrossel" },
  { kind: "thumbnail", label: "Gerar Thumbnail" },
  { kind: "vsl", label: "Gerar VSL" },
];

function AssetDetail({
  record,
  onDelete,
  busy,
}: {
  record: CreatorAsset;
  onDelete: () => void;
  busy: boolean;
}) {
  const carrossel = parseJsonStringArray(record.carrossel_instagram);
  const stories = parseJsonStringArray(record.stories);
  const [tab, setTab] = useState<AssetTab>("imagens");

  return (
    <div className="space-y-3 text-[12px]">
      <div className="flex flex-wrap items-center gap-2">
        {record.product_id && (
          <Link href="/dashboard/creator" className="text-[10px] text-violet-400 hover:underline">
            Produto no Creator →
          </Link>
        )}
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        {(
          [
            ["Nome", record.nome],
            ["Avatar", record.avatar],
            ["Problema", record.problema],
            ["Solução", record.solucao],
          ] as const
        ).map(([label, value]) => (
          <div key={label}>
            <p className="text-[10px] uppercase tracking-wide text-zinc-600">{label}</p>
            <p className="text-zinc-300">{value ?? "—"}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-1">
        {SECTION_TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={cn(
              "rounded-md px-2 py-1 text-[10px] transition-colors",
              tab === t.id
                ? "bg-amber-500/20 text-amber-200"
                : "border border-white/[0.06] text-zinc-500 hover:text-zinc-300"
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "imagens" && (
        <div className="space-y-2">
          {(
            [
              ["Criativo Facebook", record.criativo_facebook],
              ["Criativo Instagram", record.criativo_instagram],
              ["Capa Ebook", record.capa_ebook],
              ["Thumbnail YouTube", record.thumbnail_youtube],
              ["Mockup Produto", record.mockup_produto],
            ] as const
          ).map(([label, value]) => (
            <div key={label} className="rounded-md border border-white/[0.06] bg-white/[0.02] p-3">
              <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-amber-400/80">
                {label}
              </p>
              <pre className="whitespace-pre-wrap font-sans text-[11px] leading-relaxed text-zinc-300">
                {value ?? "—"}
              </pre>
            </div>
          ))}
        </div>
      )}

      {tab === "videos" && (
        <div className="space-y-2">
          {(
            [
              ["Roteiro Reels", record.roteiro_reels],
              ["Shorts", record.roteiro_shorts],
              ["TikTok", record.roteiro_tiktok],
              ["VSL", record.vsl],
            ] as const
          ).map(([label, value]) => (
            <div key={label} className="rounded-md border border-white/[0.06] bg-white/[0.02] p-3">
              <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-amber-400/80">
                {label}
              </p>
              <pre className="whitespace-pre-wrap font-sans text-[11px] leading-relaxed text-zinc-300">
                {value ?? "—"}
              </pre>
            </div>
          ))}
        </div>
      )}

      {tab === "social" && (
        <div className="space-y-2">
          <div className="rounded-md border border-white/[0.06] bg-white/[0.02] p-3">
            <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-amber-400/80">
              Carrossel Instagram
            </p>
            {carrossel.length > 0 ? (
              <ol className="list-inside list-decimal space-y-1 text-[11px] text-zinc-300">
                {carrossel.map((slide, i) => (
                  <li key={i}>{slide}</li>
                ))}
              </ol>
            ) : (
              <p className="text-zinc-500">—</p>
            )}
          </div>
          <div className="rounded-md border border-white/[0.06] bg-white/[0.02] p-3">
            <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-amber-400/80">
              Stories
            </p>
            {stories.length > 0 ? (
              <ol className="list-inside list-decimal space-y-1 text-[11px] text-zinc-300">
                {stories.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ol>
            ) : (
              <p className="text-zinc-500">—</p>
            )}
          </div>
          <div className="rounded-md border border-white/[0.06] bg-white/[0.02] p-3">
            <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-amber-400/80">
              Legendas
            </p>
            <pre className="whitespace-pre-wrap font-sans text-[11px] text-zinc-300">
              {record.legendas ?? "—"}
            </pre>
          </div>
          <div className="rounded-md border border-white/[0.06] bg-white/[0.02] p-3">
            <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-amber-400/80">
              CTA
            </p>
            <p className="text-[11px] text-zinc-300">{record.cta ?? "—"}</p>
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-2 pt-1">
        <ActionButton
          variant="ghost"
          disabled={busy}
          icon={<Trash2 className="size-3.5" />}
          onClick={onDelete}
        >
          Excluir
        </ActionButton>
      </div>
    </div>
  );
}

export function CreativeStudioView() {
  const searchParams = useSearchParams();
  const { bundles } = useCreator();
  const { dashboard, records, loading, error, busy, refresh, generate, removeRecord } =
    useCreativeStudio();

  const [intake, setIntake] = useState<StudioIntake>(EMPTY_INTAKE);
  const [activeRecord, setActiveRecord] = useState<CreatorAsset | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  const [iaInput, setIaInput] = useState("");
  const [iaLoading, setIaLoading] = useState(false);
  const [iaMessages, setIaMessages] = useState<{ role: "user" | "assistant"; text: string }[]>([
    {
      role: "assistant",
      text: "Sou a Aura Creative Studio — gero criativos, roteiros, carrosséis e todos os ativos visuais do seu produto.",
    },
  ]);

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
      });
      setShowForm(true);
    }
  }, [searchParams, bundles]);

  async function handleGenerate(kind: StudioGenerateKind) {
    const payload: StudioIntake = {
      ...intake,
      asset_id: activeRecord?.id ?? intake.asset_id,
    };
    const { record, error: genError } = await generate(payload, kind);
    if (genError || !record) {
      toast.error(genError ?? "Erro ao gerar ativos.");
      return;
    }
    setActiveRecord(record);
    setShowForm(false);
    toast.success("Ativos gerados com sucesso!");
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
          module: "studio",
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
          label="Ativos gerados"
          value={String(dashboard?.totalAssets ?? 0)}
          hint="Total no Studio"
        />
        <MetricCard
          label="Último produto"
          value={dashboard?.ultimoProduto ?? "—"}
          hint="Nome do último ativo"
        />
        <MetricCard
          label="Com roteiro"
          value={String(dashboard?.comRoteiro ?? 0)}
          hint="Roteiros de vídeo"
        />
        <MetricCard
          label="Com criativos"
          value={String(dashboard?.comCriativos ?? 0)}
          hint="Facebook + Instagram"
        />
      </div>

      <div className="flex flex-wrap gap-2">
        <ActionButton
          icon={<Palette className="size-3.5" />}
          onClick={() => {
            setShowForm(true);
            setIntake(EMPTY_INTAKE);
            setActiveRecord(null);
          }}
        >
          Novo pacote de ativos
        </ActionButton>
        {bundles.length > 0 && (
          <ActionButton
            variant="ghost"
            icon={<Image className="size-3.5" />}
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
        <Panel className="border-amber-500/15">
          <PanelHeader>
            <PanelTitle className="flex items-center gap-2">
              <Palette className="size-3.5 text-amber-400" />
              Gerar ativos visuais e de conteúdo
            </PanelTitle>
          </PanelHeader>
          <PanelContent className="space-y-3 pt-0">
            <p className="text-[11px] text-zinc-500">
              Integra dados de Legado, Research, Creator, CopyLab e Launch Center para gerar
              criativos, roteiros, carrosséis e thumbnails.
            </p>
            <CreatorLocaleFields
              value={intake}
              onChange={(next) => setIntake((c) => ({ ...c, ...next }))}
            />
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
                    className="w-full rounded-md border border-white/[0.08] bg-white/[0.03] px-2.5 py-2 text-[12px] text-zinc-100 outline-none focus:border-amber-500/40"
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
                    className="rounded-md border border-white/[0.06] px-2 py-1 text-[10px] text-zinc-400 hover:border-amber-500/30 hover:text-amber-300"
                  >
                    {b.product.nome?.slice(0, 30) ?? "Produto"}
                  </button>
                ))}
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              {GENERATE_ACTIONS.map((action) => (
                <ActionButton
                  key={action.kind}
                  disabled={busy || (!intake.nome.trim() && !intake.problema.trim())}
                  icon={
                    busy ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <Sparkles className="size-3.5" />
                    )
                  }
                  onClick={() => void handleGenerate(action.kind)}
                >
                  {action.label}
                </ActionButton>
              ))}
            </div>
          </PanelContent>
        </Panel>
      )}

      {activeRecord && (
        <Panel className="border-amber-500/20 bg-amber-500/[0.02]">
          <PanelHeader>
            <PanelTitle>{activeRecord.nome ?? "Ativos gerados"}</PanelTitle>
          </PanelHeader>
          <PanelContent className="pt-0">
            <AssetDetail
              record={activeRecord}
              busy={busy}
              onDelete={() =>
                void removeRecord(activeRecord.id).then((r) => {
                  if (r.error) toast.error(r.error);
                  else {
                    setActiveRecord(null);
                    toast.success("Ativos removidos.");
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
            <Clapperboard className="size-3.5" />
            Histórico de ativos
          </PanelTitle>
        </PanelHeader>
        <PanelContent className="space-y-2 pt-0">
          {records.length === 0 ? (
            <EmptyState
              title="Nenhum ativo ainda"
              description="Clique em Novo pacote de ativos para gerar criativos, roteiros e conteúdo social."
            />
          ) : (
            records.map((record) => (
              <div
                key={record.id}
                className="rounded-md border border-white/[0.06] bg-white/[0.02]"
              >
                <button
                  type="button"
                  onClick={() =>
                    setExpandedId((id) => (id === record.id ? null : record.id))
                  }
                  className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left"
                >
                  <div className="min-w-0">
                    <p className="truncate text-[12px] font-medium text-zinc-200">
                      {record.nome ?? "Sem título"}
                    </p>
                    <p className="text-[10px] text-zinc-500">
                      {record.criativo_facebook ? "FB" : "—"} ·{" "}
                      {record.criativo_instagram ? "IG" : "—"} ·{" "}
                      {record.roteiro_reels ? "Reels" : "—"}
                      {record.product_id ? " · vinculado" : ""}
                    </p>
                  </div>
                  <Video
                    className={cn(
                      "size-3.5 shrink-0",
                      record.vsl ? "text-amber-400" : "text-zinc-600"
                    )}
                  />
                </button>
                {expandedId === record.id && (
                  <div className="border-t border-white/[0.06] px-3 py-2">
                    <AssetDetail
                      record={record}
                      busy={busy}
                      onDelete={() =>
                        void removeRecord(record.id).then((r) => {
                          if (r.error) toast.error(r.error);
                          else toast.success("Ativos removidos.");
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

      <Panel className="border-amber-500/10">
        <PanelHeader>
          <PanelTitle className="flex items-center gap-2">
            <Sparkles className="size-3.5 text-amber-400" />
            Creative Studio · IA
          </PanelTitle>
        </PanelHeader>
        <PanelContent className="space-y-2 pt-0">
          <div className="flex flex-wrap gap-1.5">
            {STUDIO_IA_ACTIONS.map((action) => (
              <button
                key={action.id}
                type="button"
                onClick={() => void sendIaMessage(action.prompt, action.id)}
                disabled={iaLoading}
                className="rounded-md border border-white/[0.06] px-2 py-1 text-[10px] text-zinc-400 hover:border-amber-500/30 hover:text-amber-300 disabled:opacity-50"
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
                  m.role === "user" ? "text-amber-200" : "text-zinc-400"
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
              placeholder="Crie os criativos... Roteiro para Reels... Crie um anúncio..."
              className="min-w-0 flex-1 rounded-md border border-white/[0.08] bg-white/[0.03] px-2.5 py-2 text-[12px] text-zinc-100 outline-none focus:border-amber-500/40"
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
