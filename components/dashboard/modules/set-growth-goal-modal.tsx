"use client";

import { Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Modal } from "@/components/ui/modal";

type SetGrowthGoalModalProps = {
  open: boolean;
  onClose: () => void;
  currentMeta?: number;
  onSubmit: (metaReceita: number) => Promise<{ error: string | null }>;
};

export function SetGrowthGoalModal({
  open,
  onClose,
  currentMeta,
  onSubmit,
}: SetGrowthGoalModalProps) {
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const meta = Number(String(fd.get("meta")).replace(",", "."));
    if (!meta || meta <= 0) {
      toast.error("Informe uma meta válida.");
      return;
    }

    setPending(true);
    const { error } = await onSubmit(meta);
    setPending(false);

    if (error) {
      toast.error(error);
      return;
    }

    toast.success("Meta mensal definida.");
    onClose();
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Meta mensal de receita"
      description="Defina sua meta de receita para acompanhar o progresso."
    >
      <form onSubmit={handleSubmit} className="space-y-3">
        <label className="block text-[12px] text-zinc-500">
          Valor da meta (R$)
          <input
            name="meta"
            type="number"
            min="1"
            step="0.01"
            defaultValue={currentMeta && currentMeta > 0 ? currentMeta : ""}
            placeholder="10000"
            required
            className="mt-1 min-h-11 w-full rounded-md border border-white/[0.08] bg-white/[0.03] px-3 text-base text-zinc-200 focus:border-white/[0.15] focus:outline-none md:min-h-9 md:h-9 md:px-2 md:text-[13px]"
          />
        </label>
        <button
          type="submit"
          disabled={pending}
          className="flex h-9 w-full items-center justify-center gap-2 rounded-md bg-violet-600 text-[13px] font-medium text-white transition-colors hover:bg-violet-500 disabled:opacity-50"
        >
          {pending && <Loader2 className="size-3.5 animate-spin" />}
          Salvar meta
        </button>
      </form>
    </Modal>
  );
}
