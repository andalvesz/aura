"use client";

import { Pencil, Sparkles, Trash2 } from "lucide-react";
import type { Conteudo } from "@/types/database";
import { pipelinePorStatus } from "@/utils/instagram";
import {
  getConteudoStatusLabel,
  getFormatoLabel,
  getPlataformaLabel,
  getNextConteudoStatus,
  getPrevConteudoStatus,
  normalizeConteudoStatus,
} from "@/utils/social";
import { MOBILE_SCROLL_HINT_CLASS } from "@/utils/dashboard-mobile";
import { EmptyState } from "@/components/dashboard/empty-state";
import { Panel, PanelContent, PanelHeader, PanelTitle } from "@/components/dashboard/panel";

type InstagramPipelinePanelProps = {
  conteudos: Conteudo[];
  loadError?: string | null;
  onEdit: (c: Conteudo) => void;
  onRoteiro: (c: Conteudo) => void;
  onAdvanceStatus: (c: Conteudo) => void;
  onRetreatStatus: (c: Conteudo) => void;
  onDelete: (id: string) => void;
  roteiroLoadingId: string | null;
  statusLoadingId: string | null;
};

const STATUS_COLORS: Record<string, string> = {
  ideia: "border-zinc-500/20",
  roteiro: "border-violet-500/20",
  gravado: "border-sky-500/20",
  editado: "border-amber-500/20",
  publicado: "border-emerald-500/20",
};

export function InstagramPipelinePanel({
  conteudos,
  loadError = null,
  onEdit,
  onRoteiro,
  onAdvanceStatus,
  onRetreatStatus,
  onDelete,
  roteiroLoadingId,
  statusLoadingId,
}: InstagramPipelinePanelProps) {
  const columns = pipelinePorStatus(conteudos);
  const hasItems = columns.some((c) => c.items.length > 0);

  return (
    <Panel>
      <PanelHeader>
        <PanelTitle>Pipeline de conteúdo</PanelTitle>
      </PanelHeader>
      <PanelContent className="overflow-x-auto pt-0">
        {loadError ? (
          <EmptyState
            title="Não foi possível carregar conteúdos"
            description={loadError}
          />
        ) : !hasItems ? (
          <EmptyState
            title="Pipeline vazio"
            description="Gere ideias com IA ou cadastre conteúdos manualmente."
          />
        ) : (
          <>
            <p className={MOBILE_SCROLL_HINT_CLASS}>
              Deslize para ver todas as colunas →
            </p>
            <div className="flex min-w-[640px] gap-2">
              {columns.map((col) => (
                <div
                  key={col.status}
                  className={`min-w-[120px] flex-1 rounded-md border bg-zinc-950/30 p-2 ${STATUS_COLORS[col.status] ?? ""}`}
                >
                  <p className="mb-2 text-[10px] font-medium uppercase tracking-wide text-zinc-500">
                    {col.label}
                    <span className="ml-1 text-zinc-600">({col.items.length})</span>
                  </p>
                  <ul className="space-y-1.5">
                    {col.items.map((c) => {
                      const status = normalizeConteudoStatus(c.status);
                      const prev = getPrevConteudoStatus(status);
                      const next = getNextConteudoStatus(status);
                      const isBusy =
                        roteiroLoadingId === c.id || statusLoadingId === c.id;

                      return (
                        <li
                          key={c.id}
                          className="rounded border border-white/[0.04] bg-white/[0.02] p-1.5"
                        >
                          <p className="truncate text-[11px] font-medium text-zinc-200">
                            {c.titulo}
                          </p>
                          <p className="text-[9px] text-zinc-600">
                            {getPlataformaLabel(c.plataforma)}
                            {c.formato ? ` · ${getFormatoLabel(c.formato)}` : ""}
                          </p>
                          <p className="text-[9px] text-zinc-700">
                            {getConteudoStatusLabel(status)}
                          </p>
                          <div className="mt-1.5 flex flex-wrap gap-1">
                            {prev && (
                              <TextBtn
                                label="Voltar status"
                                title={`Voltar para ${getConteudoStatusLabel(prev)}`}
                                onClick={() => onRetreatStatus(c)}
                                disabled={isBusy}
                              />
                            )}
                            {next && (
                              <TextBtn
                                label="Avançar status"
                                title={
                                  next === "publicado"
                                    ? "Publicar (com confirmação)"
                                    : `Avançar para ${getConteudoStatusLabel(next)}`
                                }
                                onClick={() => onAdvanceStatus(c)}
                                disabled={isBusy}
                                accent
                              />
                            )}
                          </div>
                          <div className="mt-1 flex flex-wrap gap-0.5">
                            <IconBtn
                              title="Gerar roteiro"
                              onClick={() => onRoteiro(c)}
                              loading={roteiroLoadingId === c.id}
                              disabled={isBusy}
                            >
                              <Sparkles className="size-3" />
                            </IconBtn>
                            <IconBtn
                              title="Editar"
                              onClick={() => onEdit(c)}
                              disabled={isBusy}
                            >
                              <Pencil className="size-3" />
                            </IconBtn>
                            <IconBtn
                              title="Excluir"
                              onClick={() => onDelete(c.id)}
                              disabled={isBusy}
                            >
                              <Trash2 className="size-3" />
                            </IconBtn>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </div>
          </>
        )}
      </PanelContent>
    </Panel>
  );
}

function TextBtn({
  label,
  title,
  onClick,
  disabled,
  accent,
}: {
  label: string;
  title: string;
  onClick: () => void;
  disabled?: boolean;
  accent?: boolean;
}) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={onClick}
      className={`rounded px-1.5 py-0.5 text-[9px] font-medium disabled:opacity-50 ${
        accent
          ? "bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25"
          : "bg-white/[0.04] text-zinc-400 hover:bg-white/[0.08] hover:text-zinc-200"
      }`}
    >
      {label}
    </button>
  );
}

function IconBtn({
  children,
  title,
  onClick,
  loading,
  disabled,
}: {
  children: React.ReactNode;
  title: string;
  onClick: () => void;
  loading?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      title={title}
      disabled={loading || disabled}
      onClick={onClick}
      className="rounded p-0.5 text-zinc-500 hover:text-violet-300 disabled:opacity-50"
    >
      {children}
    </button>
  );
}
