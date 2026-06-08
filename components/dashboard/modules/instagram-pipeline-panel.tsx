"use client";

import { ChevronDown, FileText, Pencil, Sparkles, Trash2 } from "lucide-react";
import { useState } from "react";
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
      <PanelContent className="pt-0">
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
            {/* Desktop: kanban horizontal */}
            <div className="hidden gap-2 overflow-x-auto md:flex">
              {columns.map((col) => (
                <PipelineColumn
                  key={col.status}
                  col={col}
                  onEdit={onEdit}
                  onRoteiro={onRoteiro}
                  onAdvanceStatus={onAdvanceStatus}
                  onRetreatStatus={onRetreatStatus}
                  onDelete={onDelete}
                  roteiroLoadingId={roteiroLoadingId}
                  statusLoadingId={statusLoadingId}
                  compact
                />
              ))}
            </div>

            {/* Mobile: lista vertical por status */}
            <div className="space-y-3 md:hidden">
              {columns.map((col) => (
                <PipelineColumn
                  key={col.status}
                  col={col}
                  onEdit={onEdit}
                  onRoteiro={onRoteiro}
                  onAdvanceStatus={onAdvanceStatus}
                  onRetreatStatus={onRetreatStatus}
                  onDelete={onDelete}
                  roteiroLoadingId={roteiroLoadingId}
                  statusLoadingId={statusLoadingId}
                  vertical
                />
              ))}
            </div>
          </>
        )}
      </PanelContent>
    </Panel>
  );
}

type PipelineColumnProps = {
  col: ReturnType<typeof pipelinePorStatus>[number];
  onEdit: (c: Conteudo) => void;
  onRoteiro: (c: Conteudo) => void;
  onAdvanceStatus: (c: Conteudo) => void;
  onRetreatStatus: (c: Conteudo) => void;
  onDelete: (id: string) => void;
  roteiroLoadingId: string | null;
  statusLoadingId: string | null;
  compact?: boolean;
  vertical?: boolean;
};

function PipelineColumn({
  col,
  onEdit,
  onRoteiro,
  onAdvanceStatus,
  onRetreatStatus,
  onDelete,
  roteiroLoadingId,
  statusLoadingId,
  compact,
  vertical,
}: PipelineColumnProps) {
  if (col.items.length === 0) return null;

  return (
    <div
      className={`rounded-md border bg-zinc-950/30 p-2 ${STATUS_COLORS[col.status] ?? ""} ${
        compact ? "min-w-[140px] flex-1" : "w-full"
      }`}
    >
      <p className="mb-2 text-[10px] font-medium uppercase tracking-wide text-zinc-500">
        {col.label}
        <span className="ml-1 text-zinc-600">({col.items.length})</span>
      </p>
      <ul className={`space-y-1.5 ${vertical ? "" : ""}`}>
        {col.items.map((c) => (
          <PipelineCard
            key={c.id}
            item={c}
            onEdit={onEdit}
            onRoteiro={onRoteiro}
            onAdvanceStatus={onAdvanceStatus}
            onRetreatStatus={onRetreatStatus}
            onDelete={onDelete}
            roteiroLoadingId={roteiroLoadingId}
            statusLoadingId={statusLoadingId}
          />
        ))}
      </ul>
    </div>
  );
}

function PipelineCard({
  item,
  onEdit,
  onRoteiro,
  onAdvanceStatus,
  onRetreatStatus,
  onDelete,
  roteiroLoadingId,
  statusLoadingId,
}: {
  item: Conteudo;
  onEdit: (c: Conteudo) => void;
  onRoteiro: (c: Conteudo) => void;
  onAdvanceStatus: (c: Conteudo) => void;
  onRetreatStatus: (c: Conteudo) => void;
  onDelete: (id: string) => void;
  roteiroLoadingId: string | null;
  statusLoadingId: string | null;
}) {
  const [roteiroOpen, setRoteiroOpen] = useState(false);
  const status = normalizeConteudoStatus(item.status);
  const prev = getPrevConteudoStatus(status);
  const next = getNextConteudoStatus(status);
  const isBusy = roteiroLoadingId === item.id || statusLoadingId === item.id;
  const hasRoteiro = Boolean(item.roteiro?.trim());

  return (
    <li className="rounded border border-white/[0.04] bg-white/[0.02] p-2">
      <p className="truncate text-[12px] font-medium text-zinc-200">{item.titulo}</p>
      <p className="text-[10px] text-zinc-600">
        {getPlataformaLabel(item.plataforma)}
        {item.formato ? ` · ${getFormatoLabel(item.formato)}` : ""}
      </p>
      {item.data_publicacao && (
        <p className="text-[9px] text-zinc-700">
          Planejado:{" "}
          {new Date(item.data_publicacao).toLocaleDateString("pt-BR")}
        </p>
      )}

      <div className="mt-2 flex flex-wrap gap-1">
        {prev && (
          <TextBtn
            label="Voltar status"
            title={`Voltar para ${getConteudoStatusLabel(prev)}`}
            onClick={() => onRetreatStatus(item)}
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
            onClick={() => onAdvanceStatus(item)}
            disabled={isBusy}
            accent
          />
        )}
      </div>

      <div className="mt-1.5 flex flex-wrap gap-1">
        <IconBtn
          title="Gerar roteiro IA"
          onClick={() => onRoteiro(item)}
          loading={roteiroLoadingId === item.id}
          disabled={isBusy}
        >
          <Sparkles className="size-3.5" />
        </IconBtn>
        {hasRoteiro && (
          <IconBtn
            title={roteiroOpen ? "Ocultar roteiro" : "Visualizar roteiro"}
            onClick={() => setRoteiroOpen((v) => !v)}
            disabled={isBusy}
          >
            <FileText className="size-3.5" />
          </IconBtn>
        )}
        <IconBtn title="Editar" onClick={() => onEdit(item)} disabled={isBusy}>
          <Pencil className="size-3.5" />
        </IconBtn>
        <IconBtn title="Excluir" onClick={() => onDelete(item.id)} disabled={isBusy}>
          <Trash2 className="size-3.5" />
        </IconBtn>
      </div>

      {hasRoteiro && (
        <button
          type="button"
          onClick={() => setRoteiroOpen((v) => !v)}
          className="mt-1.5 flex w-full items-center gap-1 text-[10px] text-violet-300/80 hover:text-violet-200"
        >
          <ChevronDown
            className={`size-3 transition-transform ${roteiroOpen ? "rotate-180" : ""}`}
          />
          {roteiroOpen ? "Ocultar roteiro" : "Ver roteiro"}
        </button>
      )}

      {roteiroOpen && hasRoteiro && (
        <div className="mt-2 max-h-[140px] overflow-y-auto rounded-md border border-violet-500/15 bg-violet-500/[0.04] p-2">
          <p className="whitespace-pre-wrap text-[11px] leading-relaxed text-violet-100/90">
            {item.roteiro}
          </p>
        </div>
      )}
    </li>
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
      className={`rounded px-2 py-1 text-[10px] font-medium disabled:opacity-50 ${
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
      className="inline-flex min-h-8 min-w-8 items-center justify-center rounded-md text-zinc-500 hover:bg-white/[0.04] hover:text-violet-300 disabled:opacity-50"
    >
      {children}
    </button>
  );
}
