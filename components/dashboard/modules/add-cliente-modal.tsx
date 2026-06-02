"use client";

import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";
import { Modal } from "@/components/ui/modal";
import type { Cliente } from "@/types/database";

type AddClienteModalProps = {
  open: boolean;
  onClose: () => void;
  initial?: Cliente | null;
  onSubmit: (payload: {
    nome: string;
    telefone: string | null;
    instagram: string | null;
    observacoes: string | null;
  }) => Promise<{ error: string | null }>;
};

export function AddClienteModal({
  open,
  onClose,
  initial,
  onSubmit,
}: AddClienteModalProps) {
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const nome = String(fd.get("nome")).trim();
    if (!nome) {
      toast.error("Informe o nome.");
      return;
    }

    setPending(true);
    const { error } = await onSubmit({
      nome,
      telefone: String(fd.get("telefone") ?? "").trim() || null,
      instagram: String(fd.get("instagram") ?? "").trim() || null,
      observacoes: String(fd.get("observacoes") ?? "").trim() || null,
    });
    setPending(false);

    if (error) {
      toast.error(error);
      return;
    }

    toast.success(initial ? "Cliente atualizado." : "Cliente criado.");
    onClose();
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={initial ? "Editar cliente" : "Novo cliente"}
      className="max-w-md"
    >
      <form onSubmit={handleSubmit} className="space-y-3" key={initial?.id ?? "new"}>
        <Field label="Nome" name="nome" defaultValue={initial?.nome} required />
        <Field label="Telefone" name="telefone" defaultValue={initial?.telefone ?? ""} />
        <Field
          label="Instagram"
          name="instagram"
          defaultValue={initial?.instagram ?? ""}
          placeholder="@usuario"
        />
        <label className="block text-[12px] text-zinc-500">
          Observações
          <textarea
            name="observacoes"
            defaultValue={initial?.observacoes ?? ""}
            rows={3}
            className="mt-1 w-full rounded-md border border-white/[0.08] bg-white/[0.03] px-2 py-1.5 text-[13px] text-zinc-200 focus:outline-none"
          />
        </label>
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
  placeholder,
}: {
  label: string;
  name: string;
  defaultValue?: string;
  required?: boolean;
  placeholder?: string;
}) {
  return (
    <label className="block text-[12px] text-zinc-500">
      {label}
      <input
        name={name}
        defaultValue={defaultValue}
        required={required}
        placeholder={placeholder}
        className="mt-1 h-9 w-full rounded-md border border-white/[0.08] bg-white/[0.03] px-2 text-[13px] text-zinc-200 focus:outline-none"
      />
    </label>
  );
}
