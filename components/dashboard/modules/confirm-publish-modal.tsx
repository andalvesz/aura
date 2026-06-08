"use client";

import { Loader2 } from "lucide-react";
import { Modal } from "@/components/ui/modal";

type ConfirmPublishModalProps = {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  titulo: string;
  plannedDate: string | null;
  pending?: boolean;
};

export function ConfirmPublishModal({
  open,
  onClose,
  onConfirm,
  titulo,
  plannedDate,
  pending = false,
}: ConfirmPublishModalProps) {
  const plannedLabel = plannedDate
    ? new Date(`${plannedDate}T12:00:00`).toLocaleDateString("pt-BR")
    : null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Confirmar publicação"
      description="A data planejada será preservada. A data real de publicação será registrada agora."
      className="max-w-sm"
    >
      <div className="space-y-3">
        <div className="rounded-md border border-white/[0.06] bg-zinc-950/50 px-3 py-2.5 text-[13px]">
          <p className="font-medium text-zinc-200">{titulo}</p>
          {plannedLabel && (
            <p className="mt-1 text-[12px] text-zinc-500">
              Data planejada: <span className="text-zinc-300">{plannedLabel}</span>
            </p>
          )}
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            disabled={pending}
            onClick={onClose}
            className="min-h-10 flex-1 rounded-md border border-white/[0.08] bg-white/[0.03] text-[13px] text-zinc-300 hover:bg-white/[0.06] disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={onConfirm}
            className="flex min-h-10 flex-1 items-center justify-center gap-2 rounded-md bg-emerald-600 text-[13px] font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
          >
            {pending && <Loader2 className="size-4 animate-spin" />}
            Publicar
          </button>
        </div>
      </div>
    </Modal>
  );
}
