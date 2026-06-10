"use client";

import {
  Copy,
  FileText,
  Loader2,
  Megaphone,
  PenLine,
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
import { useCopylab } from "@/hooks/use-copylab";
import { useCreator } from "@/hooks/use-creator";
import type { CreatorCopylab } from "@/types/database";
import {
  COPYLAB_IA_ACTIONS,
  formatBRL,
  intakeFromProductBundle,
  parseJsonStringArray,
  type CopylabIntake,
} from "@/utils/copylab";
import { parseJsonResponse } from "@/utils/safe-json";
import { cn } from "@/utils/cn";

const EMPTY_INTAKE: CopylabIntake = {
  nome: "",
  avatar: "",
  problema: "",
  solucao: "",
  promessa: "",
  diferencial: "",
  preco: null,
  product_id: null,
  ...DEFAULT_CREATOR_LOCALE,
};

type CopyTab =
  | "core"
  | "pagina"
  | "vsl"
  | "story"
  | "email"
  | "whatsapp"
  | "instagram"
  | "facebook"
  | "google";

const COPY_TABS: { id: CopyTab; label: string }[] = [
  { id: "core", label: "Oferta" },
  { id: "pagina", label: "Página" },
  { id: "vsl", label: "VSL" },
  { id: "story", label: "Story" },
  { id: "email", label: "E-mail" },
  { id: "whatsapp", label: "WhatsApp" },
  { id: "instagram", label: "Instagram" },
  { id: "facebook", label: "Facebook" },
  { id: "google", label: "Google" },
];

function CopyDetail({
  record,
  onDelete,
  busy,
}: {
  record: CreatorCopylab;
  onDelete: () => void;
  busy: boolean;
}) {
  const bullets = parseJsonStringArray(record.bullets);
  const [tab, setTab] = useState<CopyTab>("core");

  const tabContent: Record<CopyTab, string | null> = {
    core: null,
    pagina: record.pagina_vendas,
    vsl: record.estrutura_vsl,
    story: record.storytelling,
    email: record.email_lancamento,
    whatsapp: record.whatsapp_venda,
    instagram: record.instagram_post,
    facebook: record.facebook_ad,
    google: record.google_ad,
  };

  return (
    <div className="space-y-3 text-[12px]">
      <div className="flex flex-wrap items-center gap-2">
        {record.product_id && (
          <Link
            href="/dashboard/creator"
            className="text-[10px] text-violet-400 hover:underline"
          >
            Produto no Creator →
          </Link>
        )}
        {record.preco != null && (
          <span className="rounded-md bg-emerald-500/15 px-2 py-0.5 text-[10px] text-emerald-300">
            {formatBRL(record.preco)}
          </span>
        )}
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        {[
          ["Nome", record.nome],
          ["Avatar", record.avatar],
          ["Problema", record.problema],
          ["Solução", record.solucao],
          ["Promessa", record.promessa],
          ["Diferencial", record.diferencial],
        ].map(([label, value]) => (
          <div key={label as string}>
            <p className="text-[10px] uppercase tracking-wide text-zinc-600">{label as string}</p>
            <p className="text-zinc-300">{(value as string) ?? "—"}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-1">
        {COPY_TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={cn(
              "rounded-md px-2 py-1 text-[10px] transition-colors",
              tab === t.id
                ? "bg-fuchsia-500/20 text-fuchsia-200"
                : "border border-white/[0.06] text-zinc-500 hover:text-zinc-300"
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "core" ? (
        <div className="space-y-3 rounded-md border border-fuchsia-500/15 bg-fuchsia-500/[0.04] p-3">
          <div>
            <p className="text-[10px] uppercase tracking-wide text-fuchsia-400">Headline</p>
            <p className="text-[14px] font-semibold text-zinc-100">{record.headline ?? "—"}</p>
          </div>
          {record.subheadline && (
            <div>
              <p className="text-[10px] uppercase tracking-wide text-zinc-600">Subheadline</p>
              <p className="text-zinc-300">{record.subheadline}</p>
            </div>
          )}
          {record.big_idea && (
            <div>
              <p className="text-[10px] uppercase tracking-wide text-zinc-600">Big Idea</p>
              <p className="text-zinc-300">{record.big_idea}</p>
            </div>
          )}
          {record.mecanismo_unico && (
            <div>
              <p className="text-[10px] uppercase tracking-wide text-zinc-600">Mecanismo único</p>
              <p className="text-zinc-300">{record.mecanismo_unico}</p>
            </div>
          )}
          {bullets.length > 0 && (
            <div>
              <p className="text-[10px] uppercase tracking-wide text-zinc-600">Bullets</p>
              <ul className="list-inside list-disc space-y-0.5 text-[11px] text-zinc-300">
                {bullets.map((b) => (
                  <li key={b}>{b}</li>
                ))}
              </ul>
            </div>
          )}
          <div className="grid gap-2 sm:grid-cols-3">
            {[
              ["Garantia", record.garantia],
              ["Bônus", record.bonus],
              ["CTA", record.cta],
            ].map(([label, value]) => (
              <div key={label as string} className="rounded-md border border-white/[0.06] p-2">
                <p className="text-[10px] font-medium text-zinc-500">{label as string}</p>
                <p className="text-[11px] text-zinc-300">{(value as string) ?? "—"}</p>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="rounded-md border border-white/[0.06] bg-white/[0.02] p-3">
          <p className="mb-2 text-[10px] font-medium uppercase tracking-wide text-zinc-500">
            {COPY_TABS.find((t) => t.id === tab)?.label}
          </p>
          <pre className="whitespace-pre-wrap font-sans text-[11px] leading-relaxed text-zinc-300">
            {tabContent[tab] ?? "—"}
          </pre>
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

export function CopylabView() {
  const searchParams = useSearchParams();
  const { bundles } = useCreator();
  const { dashboard, records, loading, error, busy, refresh, generate, removeRecord } =
    useCopylab();

  const [intake, setIntake] = useState<CopylabIntake>(EMPTY_INTAKE);
  const [activeRecord, setActiveRecord] = useState<CreatorCopylab | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  const [iaInput, setIaInput] = useState("");
  const [iaLoading, setIaLoading] = useState(false);
  const [iaMessages, setIaMessages] = useState<{ role: "user" | "assistant"; text: string }[]>([
    {
      role: "assistant",
      text: "Sou a Aura CopyLab — gero toda a comunicação do seu produto digital.",
    },
  ]);

  useEffect(() => {
    const productId = searchParams.get("product_id");
    const nome = searchParams.get("nome");
    const avatar = searchParams.get("avatar");
    const problema = searchParams.get("problema");
    const solucao = searchParams.get("solucao");
    const promessa = searchParams.get("promessa");
    const diferencial = searchParams.get("diferencial");
    const preco = searchParams.get("preco");

    if (productId) {
      const bundle = bundles.find((b) => b.product.id === productId);
      if (bundle) {
        setIntake(intakeFromProductBundle(bundle));
        setShowForm(true);
        return;
      }
    }

    if (nome || problema || avatar) {
      setIntake({
        nome: nome ?? "",
        avatar: avatar ?? "",
        problema: problema ?? "",
        solucao: solucao ?? "",
        promessa: promessa ?? "",
        diferencial: diferencial ?? "",
        preco: preco ? Number(preco) : null,
        product_id: productId,
      });
      setShowForm(true);
    }
  }, [searchParams, bundles]);

  async function handleGenerate() {
    const { record, error: genError } = await generate(intake);
    if (genError || !record) {
      toast.error(genError ?? "Erro ao gerar copy.");
      return;
    }
    setActiveRecord(record);
    setShowForm(false);
    toast.success("Copy gerada com sucesso!");
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
          module: "copylab",
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
          label="Copies geradas"
          value={String(dashboard?.totalCopies ?? 0)}
          hint="Total no CopyLab"
        />
        <MetricCard
          label="Último produto"
          value={dashboard?.ultimoProduto ?? "—"}
          hint="Nome da última copy"
        />
        <MetricCard
          label="Com VSL"
          value={String(dashboard?.comVsl ?? 0)}
          hint="Estruturas de VSL"
        />
        <MetricCard
          label="Vinculados"
          value={String(dashboard?.vinculados ?? 0)}
          hint="Produtos do Creator"
        />
      </div>

      <div className="flex flex-wrap gap-2">
        <ActionButton
          icon={<PenLine className="size-3.5" />}
          onClick={() => {
            setShowForm(true);
            setIntake(EMPTY_INTAKE);
            setActiveRecord(null);
          }}
        >
          Nova copy
        </ActionButton>
        {bundles.length > 0 && (
          <ActionButton
            variant="ghost"
            icon={<Copy className="size-3.5" />}
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
        <Panel className="border-fuchsia-500/15">
          <PanelHeader>
            <PanelTitle className="flex items-center gap-2">
              <Megaphone className="size-3.5 text-fuchsia-400" />
              Gerar comunicação do produto
            </PanelTitle>
          </PanelHeader>
          <PanelContent className="space-y-3 pt-0">
            <p className="text-[11px] text-zinc-500">
              A IA gera headline, oferta, página de vendas, VSL, storytelling e criativos para
              tráfego.
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
                    className="w-full rounded-md border border-white/[0.08] bg-white/[0.03] px-2.5 py-2 text-[12px] text-zinc-100 outline-none focus:border-fuchsia-500/40"
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
                  className="w-full rounded-md border border-white/[0.08] bg-white/[0.03] px-2.5 py-2 text-[12px] text-zinc-100 outline-none focus:border-fuchsia-500/40"
                />
              </label>
            </div>
            {bundles.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {bundles.slice(0, 5).map((b) => (
                  <button
                    key={b.product.id}
                    type="button"
                    onClick={() => setIntake(intakeFromProductBundle(b))}
                    className="rounded-md border border-white/[0.06] px-2 py-1 text-[10px] text-zinc-400 hover:border-fuchsia-500/30 hover:text-fuchsia-300"
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
              Gerar copy completa
            </ActionButton>
          </PanelContent>
        </Panel>
      )}

      {activeRecord && (
        <Panel className="border-fuchsia-500/20 bg-fuchsia-500/[0.02]">
          <PanelHeader>
            <PanelTitle>{activeRecord.nome ?? activeRecord.headline ?? "Copy gerada"}</PanelTitle>
          </PanelHeader>
          <PanelContent className="pt-0">
            <CopyDetail
              record={activeRecord}
              busy={busy}
              onDelete={() =>
                void removeRecord(activeRecord.id).then((r) => {
                  if (r.error) toast.error(r.error);
                  else {
                    setActiveRecord(null);
                    toast.success("Copy removida.");
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
            <FileText className="size-3.5" />
            Histórico de copies
          </PanelTitle>
        </PanelHeader>
        <PanelContent className="space-y-2 pt-0">
          {records.length === 0 ? (
            <EmptyState
              title="Nenhuma copy ainda"
              description='Clique em "Nova copy" para gerar toda a comunicação do produto.'
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
                      {record.nome ?? record.headline?.slice(0, 60) ?? "Sem título"}
                    </p>
                    <p className="text-[10px] text-zinc-500">
                      {record.headline?.slice(0, 80) ?? "—"}
                      {record.product_id ? " · vinculado" : ""}
                    </p>
                  </div>
                  <Video
                    className={cn(
                      "size-3.5 shrink-0",
                      record.estrutura_vsl ? "text-fuchsia-400" : "text-zinc-600"
                    )}
                  />
                </button>
                {expandedId === record.id && (
                  <div className="border-t border-white/[0.06] px-3 py-2">
                    <CopyDetail
                      record={record}
                      busy={busy}
                      onDelete={() =>
                        void removeRecord(record.id).then((r) => {
                          if (r.error) toast.error(r.error);
                          else toast.success("Copy removida.");
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

      <Panel className="border-fuchsia-500/10">
        <PanelHeader>
          <PanelTitle className="flex items-center gap-2">
            <Sparkles className="size-3.5 text-fuchsia-400" />
            CopyLab · IA
          </PanelTitle>
        </PanelHeader>
        <PanelContent className="space-y-2 pt-0">
          <div className="flex flex-wrap gap-1.5">
            {COPYLAB_IA_ACTIONS.map((action) => (
              <button
                key={action.id}
                type="button"
                onClick={() => void sendIaMessage(action.prompt, action.id)}
                disabled={iaLoading}
                className="rounded-md border border-white/[0.06] px-2 py-1 text-[10px] text-zinc-400 hover:border-fuchsia-500/30 hover:text-fuchsia-300 disabled:opacity-50"
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
                  m.role === "user" ? "text-fuchsia-200" : "text-zinc-400"
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
              placeholder="Crie a copy... Melhore essa oferta... Crie uma VSL..."
              className="min-w-0 flex-1 rounded-md border border-white/[0.08] bg-white/[0.03] px-2.5 py-2 text-[12px] text-zinc-100 outline-none focus:border-fuchsia-500/40"
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
