"use client";

import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";
import { Modal } from "@/components/ui/modal";
import type { EstoqueItem } from "@/types/database";

type AddEstoqueModalProps = {
  open: boolean;
  onClose: () => void;
  initial?: EstoqueItem | null;
  onSubmit: (payload: {
    produto: string;
    quantidade: number;
    unidade: string;
    minimo_alerta: number;
  }) => Promise<{ error: string | null }>;
};

export function AddEstoqueModal({
  open,
  onClose,
  initial,
  onSubmit,
}: AddEstoqueModalProps) {
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const produto = String(fd.get("produto")).trim();
    const quantidade = Number(fd.get("quantidade"));
    const minimo_alerta = Number(fd.get("minimo_alerta"));
    const unidade = String(fd.get("unidade") || "un").trim();

    if (!produto) {
      toast.error("Informe o item.");
      return;
    }

    setPending(true);
    const { error } = await onSubmit({
      produto,
      quantidade: Number.isFinite(quantidade) ? quantidade : 0,
      unidade,
      minimo_alerta: Number.isFinite(minimo_alerta) ? minimo_alerta : 0,
    });
    setPending(false);

    if (error) {
      toast.error(error);
      return;
    }

    toast.success(initial ? "Item atualizado." : "Item cadastrado.");
    onClose();
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={initial ? "Editar estoque" : "Novo item de estoque"}
      className="max-w-md"
    >
      <form onSubmit={handleSubmit} className="space-y-3" key={initial?.id ?? "new"}>
        <Field label="Item" name="produto" defaultValue={initial?.produto} required />
        <div className="grid grid-cols-3 gap-2">
          <Field
            label="Quantidade"
            name="quantidade"
            type="number"
            min="0"
            step="0.01"
            defaultValue={String(initial?.quantidade ?? 0)}
            required
          />
          <Field
            label="Mínimo"
            name="minimo_alerta"
            type="number"
            min="0"
            step="0.01"
            defaultValue={String(initial?.minimo_alerta ?? 0)}
          />
          <Field label="Unidade" name="unidade" defaultValue={initial?.unidade ?? "un"} />
        </div>
        <button
          type="submit"
          disabled={pending}
          className="flex h-9 w-full items-center justify-center gap-2 rounded-md border border-white/[0.1] bg-white/[0.06] text-[13px] font-medium disabled:opacity-50"
        >
          {pending && <Loader2 className="size-3.5 animate-spin" />}
          Salvar
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
  min,
  step,
}: {
  label: string;
  name: string;
  defaultValue?: string;
  required?: boolean;
  type?: string;
  min?: string;
  step?: string;
}) {
  return (
    <label className="block text-[12px] text-zinc-500">
      {label}
      <input
        name={name}
        type={type}
        defaultValue={defaultValue}
        required={required}
        min={min}
        step={step}
        className="mt-1 h-9 w-full rounded-md border border-white/[0.08] bg-white/[0.03] px-2 text-[13px] text-zinc-200 focus:outline-none"
      />
    </label>
  );
}
