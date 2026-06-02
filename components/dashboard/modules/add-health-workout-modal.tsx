"use client";

import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Modal } from "@/components/ui/modal";
import {
  exerciciosToJson,
  HEALTH_GRUPOS_MUSCULARES,
  todayIsoDate,
  type ParsedWorkoutSuggestion,
  type WorkoutExercise,
} from "@/utils/health";

type AddHealthWorkoutModalProps = {
  open: boolean;
  onClose: () => void;
  initial?: ParsedWorkoutSuggestion | null;
  onSubmit: (payload: {
    nome: string;
    grupo_muscular: string;
    exercicios: ReturnType<typeof exerciciosToJson>;
    duracao_min: number;
    observacoes: string | null;
    data: string;
  }) => Promise<{ error: string | null }>;
};

export function AddHealthWorkoutModal({
  open,
  onClose,
  initial,
  onSubmit,
}: AddHealthWorkoutModalProps) {
  const [pending, setPending] = useState(false);
  const [nome, setNome] = useState("");
  const [grupo, setGrupo] = useState("geral");
  const [duracao, setDuracao] = useState(45);
  const [obs, setObs] = useState("");
  const [exerciciosText, setExerciciosText] = useState("");

  useEffect(() => {
    if (!open) return;
    if (initial) {
      setNome(initial.nome);
      setGrupo(initial.grupo_muscular);
      setDuracao(initial.duracao_min);
      setObs(initial.observacoes ?? "");
      setExerciciosText(
        initial.exercicios
          .map((e) =>
            [e.nome, e.series && `${e.series}x`, e.reps, e.observacao]
              .filter(Boolean)
              .join(" ")
          )
          .join("\n")
      );
    } else {
      setNome("");
      setGrupo("geral");
      setDuracao(45);
      setObs("");
      setExerciciosText("");
    }
  }, [open, initial]);

  function parseExerciciosFromText(text: string): WorkoutExercise[] {
    return text
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => ({ nome: line }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!nome.trim()) {
      toast.error("Informe o nome do treino.");
      return;
    }

    setPending(true);
    const { error } = await onSubmit({
      nome: nome.trim(),
      grupo_muscular: grupo,
      exercicios: exerciciosToJson(parseExerciciosFromText(exerciciosText)),
      duracao_min: duracao,
      observacoes: obs.trim() || null,
      data: todayIsoDate(),
    });
    setPending(false);

    if (error) {
      toast.error(error);
      return;
    }

    toast.success("Treino salvo.");
    onClose();
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={initial ? "Confirmar treino sugerido" : "Novo treino"}
      className="max-w-lg"
    >
      <form onSubmit={handleSubmit} className="space-y-3">
        <label className="block text-[12px] text-zinc-500">
          Nome
          <input
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            required
            className="mt-1 h-9 w-full rounded-md border border-white/[0.08] bg-white/[0.03] px-2 text-[13px] text-zinc-200"
          />
        </label>
        <label className="block text-[12px] text-zinc-500">
          Grupo muscular
          <select
            value={grupo}
            onChange={(e) => setGrupo(e.target.value)}
            className="mt-1 h-9 w-full rounded-md border border-white/[0.08] bg-white/[0.03] px-2 text-[13px] text-zinc-200"
          >
            {HEALTH_GRUPOS_MUSCULARES.map((g) => (
              <option key={g} value={g} className="bg-zinc-900 capitalize">
                {g.replace("_", " ")}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-[12px] text-zinc-500">
          Duração (min)
          <input
            type="number"
            min={0}
            value={duracao}
            onChange={(e) => setDuracao(Number(e.target.value) || 0)}
            className="mt-1 h-9 w-full rounded-md border border-white/[0.08] bg-white/[0.03] px-2 text-[13px] text-zinc-200"
          />
        </label>
        <label className="block text-[12px] text-zinc-500">
          Exercícios (um por linha)
          <textarea
            value={exerciciosText}
            onChange={(e) => setExerciciosText(e.target.value)}
            rows={5}
            className="mt-1 w-full rounded-md border border-white/[0.08] bg-white/[0.03] px-2 py-1.5 text-[13px] text-zinc-200"
          />
        </label>
        <label className="block text-[12px] text-zinc-500">
          Observações
          <textarea
            value={obs}
            onChange={(e) => setObs(e.target.value)}
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
          Salvar treino
        </button>
      </form>
    </Modal>
  );
}
