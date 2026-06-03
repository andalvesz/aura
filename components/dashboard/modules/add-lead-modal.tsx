"use client";

import { Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Modal } from "@/components/ui/modal";
import { LEAD_STATUSES } from "@/utils/consorcios";
import { resetHtmlForm } from "@/utils/html-form";

type AddLeadModalProps = {
  open: boolean;
  onClose: () => void;
  onSubmit: (payload: {
    nome: string;
    telefone: string;
    origem: string;
    status: string;
    observacoes: string;
  }) => Promise<{ error: string | null }>;
};

export function AddLeadModal({ open, onClose, onSubmit }: AddLeadModalProps) {
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    const nome = String(fd.get("nome")).trim();
    if (!nome) {
      toast.error("Informe o nome do lead.");
      return;
    }

    setPending(true);
    const { error } = await onSubmit({
      nome,
      telefone: String(fd.get("telefone") ?? ""),
      origem: String(fd.get("origem") ?? "outro"),
      status: String(fd.get("status") ?? "novo"),
      observacoes: String(fd.get("observacoes") ?? ""),
    });
    setPending(false);

    if (error) {
      toast.error(error);
      return;
    }

    toast.success("Lead adicionado.");
    resetHtmlForm(form);
    onClose();
  }

  return (
    <Modal open={open} onClose={onClose} title="Novo lead" description="Cadastre um lead no pipeline.">
      <form onSubmit={handleSubmit} className="space-y-3">
        <Field label="Nome" name="nome" required />
        <Field label="Telefone" name="telefone" placeholder="(11) 99999-0000" />
        <Field label="Origem" name="origem" placeholder="Instagram, indicação..." />
        <label className="block text-[12px] text-zinc-500">
          Status
          <select
            name="status"
            defaultValue="novo"
            className="mt-1 min-h-11 w-full rounded-md border border-white/[0.08] bg-white/[0.03] px-3 text-base text-zinc-200 focus:border-white/[0.15] focus:outline-none md:min-h-9 md:h-9 md:px-2 md:text-[13px]"
          >
            {LEAD_STATUSES.map((s) => (
              <option key={s.value} value={s.value} className="bg-zinc-900">
                {s.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-[12px] text-zinc-500">
          Observações
          <textarea
            name="observacoes"
            rows={2}
            className="mt-1 w-full rounded-md border border-white/[0.08] bg-white/[0.03] px-2 py-1.5 text-[13px] text-zinc-200 focus:outline-none"
          />
        </label>
        <button
          type="submit"
          disabled={pending}
          className="flex h-9 w-full items-center justify-center gap-2 rounded-md border border-white/[0.1] bg-white/[0.06] text-[13px] font-medium disabled:opacity-50"
        >
          {pending && <Loader2 className="size-3.5 animate-spin" />}
          Salvar lead
        </button>
      </form>
    </Modal>
  );
}

function Field({
  label,
  name,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <label className="block text-[12px] text-zinc-500">
      {label}
      <input
        name={name}
        className="mt-1 min-h-11 w-full rounded-md border border-white/[0.08] bg-white/[0.03] px-3 text-base text-zinc-200 focus:border-white/[0.15] focus:outline-none md:min-h-9 md:h-9 md:px-2 md:text-[13px]"
        {...props}
      />
    </label>
  );
}
