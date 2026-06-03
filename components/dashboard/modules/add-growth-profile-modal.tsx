"use client";

import { Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Modal } from "@/components/ui/modal";
import { resetHtmlForm } from "@/utils/html-form";
import { GROWTH_PLATFORMS } from "@/utils/growth";

type AddGrowthProfileModalProps = {
  open: boolean;
  onClose: () => void;
  onSubmit: (payload: {
    plataforma: string;
    username: string;
    nicho: string;
    objetivo: string;
    observacoes: string;
  }) => Promise<{ error: string | null }>;
};

export function AddGrowthProfileModal({
  open,
  onClose,
  onSubmit,
}: AddGrowthProfileModalProps) {
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    const username = String(fd.get("username")).trim();
    if (!username) {
      toast.error("Informe o username do perfil.");
      return;
    }

    setPending(true);
    const { error } = await onSubmit({
      plataforma: String(fd.get("plataforma") ?? "Instagram"),
      username,
      nicho: String(fd.get("nicho") ?? ""),
      objetivo: String(fd.get("objetivo") ?? ""),
      observacoes: String(fd.get("observacoes") ?? ""),
    });
    setPending(false);

    if (error) {
      toast.error(error);
      return;
    }

    toast.success("Perfil cadastrado.");
    resetHtmlForm(form);
    onClose();
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Cadastrar perfil"
      description="Adicione um perfil para análise e estratégia de crescimento."
    >
      <form onSubmit={handleSubmit} className="space-y-3">
        <label className="block text-[12px] text-zinc-500">
          Plataforma
          <select
            name="plataforma"
            defaultValue="Instagram"
            className="mt-1 min-h-11 w-full rounded-md border border-white/[0.08] bg-white/[0.03] px-3 text-base text-zinc-200 focus:border-white/[0.15] focus:outline-none md:min-h-9 md:h-9 md:px-2 md:text-[13px]"
          >
            {GROWTH_PLATFORMS.map((p) => (
              <option key={p} value={p} className="bg-zinc-900">
                {p}
              </option>
            ))}
          </select>
        </label>
        <Field label="Username" name="username" placeholder="seu_usuario" required />
        <Field label="Nicho" name="nicho" placeholder="Eventos, lifestyle..." />
        <Field label="Objetivo" name="objetivo" placeholder="Gerar leads, autoridade..." />
        <label className="block text-[12px] text-zinc-500">
          Observações
          <textarea
            name="observacoes"
            rows={2}
            placeholder="Notas sobre posicionamento, bio, conteúdo..."
            className="mt-1 w-full rounded-md border border-white/[0.08] bg-white/[0.03] px-2 py-1.5 text-[13px] text-zinc-200 focus:outline-none"
          />
        </label>
        <button
          type="submit"
          disabled={pending}
          className="flex h-9 w-full items-center justify-center gap-2 rounded-md bg-violet-600 text-[13px] font-medium text-white transition-colors hover:bg-violet-500 disabled:opacity-50"
        >
          {pending && <Loader2 className="size-3.5 animate-spin" />}
          Salvar perfil
        </button>
      </form>
    </Modal>
  );
}

function Field({
  label,
  name,
  placeholder,
  required,
}: {
  label: string;
  name: string;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <label className="block text-[12px] text-zinc-500">
      {label}
      <input
        name={name}
        required={required}
        placeholder={placeholder}
        className="mt-1 min-h-11 w-full rounded-md border border-white/[0.08] bg-white/[0.03] px-3 text-base text-zinc-200 focus:border-white/[0.15] focus:outline-none md:min-h-9 md:h-9 md:px-2 md:text-[13px]"
      />
    </label>
  );
}
