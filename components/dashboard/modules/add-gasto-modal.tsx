"use client";

import { Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Modal } from "@/components/ui/modal";
import { GASTO_CATEGORIAS } from "@/utils/finance";
import { resetHtmlForm } from "@/utils/html-form";

type AddGastoModalProps = {
  open: boolean;
  onClose: () => void;
  onSubmit: (payload: {
    titulo: string;
    valor: number;
    categoria: string;
    data: string;
  }) => Promise<{ error: string | null }>;
};

export function AddGastoModal({ open, onClose, onSubmit }: AddGastoModalProps) {
  const [pending, setPending] = useState(false);
  const today = new Date().toISOString().slice(0, 10);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    const titulo = String(fd.get("titulo")).trim();
    const valor = Number(fd.get("valor"));
    const categoria = String(fd.get("categoria"));
    const data = String(fd.get("data"));

    if (!titulo || !valor || valor <= 0) {
      toast.error("Preencha título e valor válidos.");
      return;
    }

    setPending(true);
    const { error } = await onSubmit({ titulo, valor, categoria, data });
    setPending(false);

    if (error) {
      toast.error(error);
      return;
    }

    toast.success("Gasto adicionado.");
    resetHtmlForm(form);
    onClose();
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Adicionar gasto"
      description="Registre uma nova despesa do mês."
    >
      <form onSubmit={handleSubmit} className="space-y-3">
        <Field label="Título" name="titulo" placeholder="Ex: Supermercado" required />
        <Field
          label="Valor (R$)"
          name="valor"
          type="number"
          step="0.01"
          min="0.01"
          placeholder="0,00"
          required
        />
        <label className="block text-[12px] text-zinc-500">
          Categoria
          <select
            name="categoria"
            required
            className="mt-1 h-9 w-full rounded-md border border-white/[0.08] bg-white/[0.03] px-2 text-[13px] text-zinc-200 focus:border-white/[0.15] focus:outline-none"
          >
            {GASTO_CATEGORIAS.map((c) => (
              <option key={c.value} value={c.value} className="bg-zinc-900">
                {c.label}
              </option>
            ))}
          </select>
        </label>
        <Field label="Data" name="data" type="date" defaultValue={today} required />
        <button
          type="submit"
          disabled={pending}
          className="flex h-9 w-full items-center justify-center gap-2 rounded-md border border-white/[0.1] bg-white/[0.06] text-[13px] font-medium text-zinc-100 transition-colors hover:bg-white/[0.1] disabled:opacity-50"
        >
          {pending && <Loader2 className="size-3.5 animate-spin" />}
          Salvar gasto
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
