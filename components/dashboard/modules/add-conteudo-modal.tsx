"use client";

import { Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Modal } from "@/components/ui/modal";
import { FORM_GRID_2_CLASS } from "@/utils/dashboard-mobile";
import type { Conteudo, InstagramMarca } from "@/types/database";
import {
  CONTEUDO_FORMATOS,
  CONTEUDO_PLATAFORMAS,
  CONTEUDO_STATUSES,
  getFormatoLabel,
  getPlataformaLabel,
  normalizeConteudoFormato,
  normalizeConteudoStatus,
} from "@/utils/social";

export type ConteudoFormPayload = {
  titulo: string;
  plataforma: string;
  formato: string | null;
  data_publicacao: string | null;
  status: string;
  objetivo: string | null;
  observacoes: string | null;
  roteiro: string | null;
  marca?: InstagramMarca | null;
};

type AddConteudoModalProps = {
  open: boolean;
  onClose: () => void;
  initial?: Conteudo | null;
  defaultMarca?: InstagramMarca;
  onSubmit: (payload: ConteudoFormPayload) => Promise<{ error: string | null }>;
};

export function AddConteudoModal({
  open,
  onClose,
  initial,
  defaultMarca,
  onSubmit,
}: AddConteudoModalProps) {
  const [pending, setPending] = useState(false);
  const isEdit = Boolean(initial);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const titulo = String(fd.get("titulo")).trim();
    if (!titulo) {
      toast.error("Informe o título.");
      return;
    }

    const dataRaw = String(fd.get("data_planejada") ?? "");
    const data_publicacao = dataRaw
      ? new Date(`${dataRaw}T12:00:00`).toISOString()
      : null;
    const status = String(fd.get("status"));
    const wasPublished =
      initial && normalizeConteudoStatus(initial.status) === "publicado";

    if (status === "publicado" && !wasPublished) {
      const planned = dataRaw
        ? new Date(`${dataRaw}T12:00:00`).toLocaleDateString("pt-BR")
        : null;
      const message = planned
        ? `Marcar como publicado? A data planejada (${planned}) será preservada.`
        : "Marcar este conteúdo como publicado?";
      if (!confirm(message)) return;
    }

    setPending(true);
    const { error } = await onSubmit({
      titulo,
      plataforma: String(fd.get("plataforma")),
      formato: String(fd.get("formato") || "") || null,
      data_publicacao,
      status,
      objetivo: String(fd.get("objetivo") ?? "").trim() || null,
      observacoes: String(fd.get("observacoes") ?? "").trim() || null,
      roteiro: String(fd.get("roteiro") ?? "").trim() || null,
      marca: initial?.marca ?? defaultMarca ?? null,
    });
    setPending(false);

    if (error) {
      toast.error(error);
      return;
    }

    toast.success(isEdit ? "Conteúdo atualizado." : "Conteúdo criado.");
    onClose();
  }

  const dataPlanejada = initial?.data_publicacao
    ? new Date(initial.data_publicacao).toISOString().slice(0, 10)
    : "";

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? "Editar conteúdo" : "Novo conteúdo"}
      description="Ideia, roteiro ou post no calendário editorial."
      className="max-w-lg"
    >
      <form onSubmit={handleSubmit} className="space-y-3" key={initial?.id ?? "new"}>
        <Field
          label="Título"
          name="titulo"
          defaultValue={initial?.titulo}
          required
        />
        <label className="block text-[12px] text-zinc-500">
          Plataforma
          <select
            name="plataforma"
            defaultValue={initial?.plataforma ?? "instagram"}
            className="mt-1 min-h-11 w-full rounded-md border border-white/[0.08] bg-white/[0.03] px-3 text-base text-zinc-200 focus:border-white/[0.15] focus:outline-none md:min-h-9 md:h-9 md:px-2 md:text-[13px]"
          >
            {CONTEUDO_PLATAFORMAS.map((p) => (
              <option key={p} value={p} className="bg-zinc-900">
                {getPlataformaLabel(p)}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-[12px] text-zinc-500">
          Formato
          <select
            name="formato"
            defaultValue={normalizeConteudoFormato(initial?.formato ?? null)}
            className="mt-1 min-h-11 w-full rounded-md border border-white/[0.08] bg-white/[0.03] px-3 text-base text-zinc-200 focus:border-white/[0.15] focus:outline-none md:min-h-9 md:h-9 md:px-2 md:text-[13px]"
          >
            {CONTEUDO_FORMATOS.map((f) => (
              <option key={f} value={f} className="bg-zinc-900">
                {getFormatoLabel(f)}
              </option>
            ))}
          </select>
        </label>
        <div className={FORM_GRID_2_CLASS}>
          <Field
            label="Data planejada"
            name="data_planejada"
            type="date"
            defaultValue={dataPlanejada}
          />
          <label className="block text-[12px] text-zinc-500">
            Status
            <select
              name="status"
              defaultValue={initial?.status ?? "ideia"}
              className="mt-1 min-h-11 w-full rounded-md border border-white/[0.08] bg-white/[0.03] px-3 text-base text-zinc-200 focus:border-white/[0.15] focus:outline-none md:min-h-9 md:h-9 md:px-2 md:text-[13px]"
            >
              {CONTEUDO_STATUSES.map((s) => (
                <option key={s.id} value={s.id} className="bg-zinc-900">
                  {s.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <Field label="Objetivo" name="objetivo" defaultValue={initial?.objetivo ?? ""} />
        <label className="block text-[12px] text-zinc-500">
          Observações
          <textarea
            name="observacoes"
            defaultValue={initial?.observacoes ?? ""}
            rows={2}
            className="mt-1 w-full rounded-md border border-white/[0.08] bg-white/[0.03] px-2 py-1.5 text-[13px] text-zinc-200 focus:outline-none"
          />
        </label>
        <label className="block text-[12px] text-zinc-500">
          Roteiro
          <textarea
            name="roteiro"
            defaultValue={initial?.roteiro ?? ""}
            rows={4}
            placeholder="Cole ou gere com IA"
            className="mt-1 w-full rounded-md border border-white/[0.08] bg-white/[0.03] px-2 py-1.5 text-[13px] text-zinc-200 focus:outline-none"
          />
        </label>
        <button
          type="submit"
          disabled={pending}
          className="flex h-9 w-full items-center justify-center gap-2 rounded-md border border-white/[0.1] bg-white/[0.06] text-[13px] font-medium transition-colors hover:bg-white/[0.1] disabled:opacity-50"
        >
          {pending && <Loader2 className="size-3.5 animate-spin" />}
          {isEdit ? "Salvar" : "Criar conteúdo"}
        </button>
      </form>
    </Modal>
  );
}

function Field({
  label,
  name,
  defaultValue,
  required,
  type = "text",
}: {
  label: string;
  name: string;
  defaultValue?: string | null;
  required?: boolean;
  type?: string;
}) {
  return (
    <label className="block text-[12px] text-zinc-500">
      {label}
      <input
        name={name}
        type={type}
        defaultValue={defaultValue ?? ""}
        required={required}
        className="mt-1 min-h-11 w-full rounded-md border border-white/[0.08] bg-white/[0.03] px-3 text-base text-zinc-200 focus:border-white/[0.15] focus:outline-none md:min-h-9 md:h-9 md:px-2 md:text-[13px]"
      />
    </label>
  );
}
