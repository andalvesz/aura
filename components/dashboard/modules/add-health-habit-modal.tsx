"use client";

import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";
import { Modal } from "@/components/ui/modal";
import { HEALTH_HABIT_FREQUENCIAS, HEALTH_HABIT_STATUSES, todayIsoDate } from "@/utils/health";

type AddHealthHabitModalProps = {
  open: boolean;
  onClose: () => void;
  onSubmit: (payload: {
    titulo: string;
    frequencia: string;
    status: string;
    data: string;
  }) => Promise<{ error: string | null }>;
};

export function AddHealthHabitModal({ open, onClose, onSubmit }: AddHealthHabitModalProps) {
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const titulo = String(fd.get("titulo")).trim();
    if (!titulo) {
      toast.error("Informe o título do hábito.");
      return;
    }

    setPending(true);
    const { error } = await onSubmit({
      titulo,
      frequencia: String(fd.get("frequencia")),
      status: String(fd.get("status")),
      data: String(fd.get("data") || todayIsoDate()),
    });
    setPending(false);

    if (error) {
      toast.error(error);
      return;
    }

    toast.success("Hábito cadastrado.");
    onClose();
  }

  return (
    <Modal open={open} onClose={onClose} title="Novo hábito" className="max-w-md">
      <form onSubmit={handleSubmit} className="space-y-3">
        <Field label="Título" name="titulo" required placeholder="Ex: Alongamento 10 min" />
        <label className="block text-[12px] text-zinc-500">
          Frequência
          <select
            name="frequencia"
            defaultValue="diario"
            className="mt-1 min-h-11 w-full rounded-md border border-white/[0.08] bg-white/[0.03] px-3 text-base text-zinc-200 focus:border-white/[0.15] focus:outline-none md:min-h-9 md:h-9 md:px-2 md:text-[13px]"
          >
            {HEALTH_HABIT_FREQUENCIAS.map((f) => (
              <option key={f.id} value={f.id} className="bg-zinc-900">
                {f.label}
              </option>
            ))}
          </select>
        </label>
        <div className="grid grid-cols-2 gap-2">
          <label className="block text-[12px] text-zinc-500">
            Status
            <select
              name="status"
              defaultValue="ativo"
              className="mt-1 min-h-11 w-full rounded-md border border-white/[0.08] bg-white/[0.03] px-3 text-base text-zinc-200 focus:border-white/[0.15] focus:outline-none md:min-h-9 md:h-9 md:px-2 md:text-[13px]"
            >
              {HEALTH_HABIT_STATUSES.map((s) => (
                <option key={s.id} value={s.id} className="bg-zinc-900">
                  {s.label}
                </option>
              ))}
            </select>
          </label>
          <Field label="Data" name="data" type="date" defaultValue={todayIsoDate()} />
        </div>
        <Submit pending={pending} />
      </form>
    </Modal>
  );
}

function Field(props: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  const { label, ...rest } = props;
  return (
    <label className="block text-[12px] text-zinc-500">
      {label}
      <input
        className="mt-1 min-h-11 w-full rounded-md border border-white/[0.08] bg-white/[0.03] px-3 text-base text-zinc-200 focus:border-white/[0.15] focus:outline-none md:min-h-9 md:h-9 md:px-2 md:text-[13px]"
        {...rest}
      />
    </label>
  );
}

function Submit({ pending }: { pending: boolean }) {
  return (
    <button
      type="submit"
      disabled={pending}
      className="flex h-9 w-full items-center justify-center gap-2 rounded-md border border-white/[0.1] bg-white/[0.06] text-[13px] font-medium disabled:opacity-50"
    >
      {pending && <Loader2 className="size-3.5 animate-spin" />}
      Salvar
    </button>
  );
}
