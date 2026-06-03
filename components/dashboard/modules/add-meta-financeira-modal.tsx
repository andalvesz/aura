"use client";

import { Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Modal } from "@/components/ui/modal";
import { resetHtmlForm } from "@/utils/html-form";

type AddMetaFinanceiraModalProps = {
  open: boolean;
  onClose: () => void;
  onSubmit: (payload: {
    titulo: string;
    valor_meta: number;
    data_inicio: string;
    data_fim: string;
  }) => Promise<{ error: string | null }>;
};

export function AddMetaFinanceiraModal({
  open,
  onClose,
  onSubmit,
}: AddMetaFinanceiraModalProps) {
  const [pending, setPending] = useState(false);
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    .toISOString()
    .slice(0, 10);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0)
    .toISOString()
    .slice(0, 10);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    const titulo = String(fd.get("titulo")).trim();
    const valor_meta = Number(fd.get("valor_meta"));
    const data_inicio = String(fd.get("data_inicio"));
    const data_fim = String(fd.get("data_fim"));

    if (!titulo || !valor_meta || valor_meta <= 0) {
      toast.error("Preencha título e meta válidos.");
      return;
    }

    if (data_fim < data_inicio) {
      toast.error("Data fim deve ser após o início.");
      return;
    }

    setPending(true);
    const { error } = await onSubmit({
      titulo,
      valor_meta,
      data_inicio,
      data_fim,
    });
    setPending(false);

    if (error) {
      toast.error(error);
      return;
    }

    toast.success("Meta criada.");
    resetHtmlForm(form);
    onClose();
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Nova meta financeira"
      description="Ex: Ganhar R$ 5.000 em Junho"
    >
      <form onSubmit={handleSubmit} className="space-y-3">
        <Field
          label="Título"
          name="titulo"
          placeholder="Ex: Ganhar R$ 5.000 em Junho"
          required
        />
        <Field
          label="Valor da meta (R$)"
          name="valor_meta"
          type="number"
          step="0.01"
          min="0.01"
          placeholder="5000"
          required
        />
        <Field label="Início" name="data_inicio" type="date" defaultValue={monthStart} required />
        <Field label="Fim" name="data_fim" type="date" defaultValue={monthEnd} required />
        <button
          type="submit"
          disabled={pending}
          className="flex h-9 w-full items-center justify-center gap-2 rounded-md border border-white/[0.1] bg-white/[0.06] text-[13px] font-medium text-zinc-100 transition-colors hover:bg-white/[0.1] disabled:opacity-50"
        >
          {pending && <Loader2 className="size-3.5 animate-spin" />}
          Criar meta
        </button>
      </form>
    </Modal>
  );
}

function Field({
  label,
  name,
  type = "text",
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <label className="block text-[12px] text-zinc-500">
      {label}
      <input
        name={name}
        type={type}
        className="mt-1 h-9 w-full rounded-md border border-white/[0.08] bg-white/[0.03] px-2 text-[13px] text-zinc-200 placeholder:text-zinc-600 focus:border-white/[0.15] focus:outline-none"
        {...props}
      />
    </label>
  );
}
