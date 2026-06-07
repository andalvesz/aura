"use client";

import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";
import { Modal } from "@/components/ui/modal";
import { FORM_GRID_2_CLASS } from "@/utils/dashboard-mobile";
import type { HealthSessionTipo } from "@/types/database";
import { todayIsoDate } from "@/utils/health";

type AddHealthSessionModalProps = {
  open: boolean;
  onClose: () => void;
  defaultTipo?: HealthSessionTipo;
  onSubmit: (payload: {
    tipo: HealthSessionTipo;
    titulo: string;
    duracao_min: number;
    data: string;
    status: string;
    observacoes: string | null;
  }) => Promise<{ error: string | null }>;
};

export function AddHealthSessionModal({
  open,
  onClose,
  defaultTipo = "leitura",
  onSubmit,
}: AddHealthSessionModalProps) {
  const [pending, setPending] = useState(false);
  const title = defaultTipo === "meditacao" ? "Nova meditação" : "Nova leitura";

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const titulo = String(fd.get("titulo")).trim();
    if (!titulo) {
      toast.error("Informe o título.");
      return;
    }

    setPending(true);
    const { error } = await onSubmit({
      tipo: defaultTipo,
      titulo,
      duracao_min: Number(fd.get("duracao_min")) || 0,
      data: String(fd.get("data") || todayIsoDate()),
      status: String(fd.get("status") ?? "planejado"),
      observacoes: String(fd.get("observacoes") ?? "").trim() || null,
    });
    setPending(false);

    if (error) {
      toast.error(error);
      return;
    }

    toast.success(defaultTipo === "meditacao" ? "Meditação cadastrada." : "Leitura cadastrada.");
    onClose();
  }

  return (
    <Modal open={open} onClose={onClose} title={title} className="max-w-md">
      <form onSubmit={handleSubmit} className="space-y-3">
        <input type="hidden" name="tipo" value={defaultTipo} />
        <label className="block text-[12px] text-zinc-500">
          Título
          <input
            name="titulo"
            required
            placeholder={
              defaultTipo === "meditacao" ? "Meditação guiada 10 min" : "Capítulo do livro X"
            }
            className="mt-1 min-h-11 w-full rounded-md border border-white/[0.08] bg-white/[0.03] px-3 text-base text-zinc-200 focus:border-white/[0.15] focus:outline-none md:min-h-9 md:h-9 md:px-2 md:text-[13px]"
          />
        </label>
        <div className={FORM_GRID_2_CLASS}>
          <label className="block text-[12px] text-zinc-500">
            Duração (min)
            <input
              name="duracao_min"
              type="number"
              min={0}
              defaultValue={defaultTipo === "meditacao" ? 10 : 20}
              className="mt-1 min-h-11 w-full rounded-md border border-white/[0.08] bg-white/[0.03] px-3 text-base text-zinc-200 focus:border-white/[0.15] focus:outline-none md:min-h-9 md:h-9 md:px-2 md:text-[13px]"
            />
          </label>
          <label className="block text-[12px] text-zinc-500">
            Data
            <input
              name="data"
              type="date"
              defaultValue={todayIsoDate()}
              className="mt-1 min-h-11 w-full rounded-md border border-white/[0.08] bg-white/[0.03] px-3 text-base text-zinc-200 focus:border-white/[0.15] focus:outline-none md:min-h-9 md:h-9 md:px-2 md:text-[13px]"
            />
          </label>
        </div>
        <label className="block text-[12px] text-zinc-500">
          Observações
          <textarea
            name="observacoes"
            rows={2}
            className="mt-1 w-full rounded-md border border-white/[0.08] bg-white/[0.03] px-2 py-1.5 text-[13px] text-zinc-200"
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
