"use client";

import { useTransition } from "react";
import {
  bootstrapCognitiveEngineAction,
  generateCognitiveArtifactsAction,
} from "@/app/actions/cognitive";

export function CognitiveBootstrapButton() {
  const [pending, start] = useTransition();

  const run = (
    fn: () => Promise<{ error: string | null; generated?: number }>
  ) => {
    start(async () => {
      await fn();
    });
  };

  return (
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        disabled={pending}
        data-testid="cognitive-bootstrap-button"
        className="rounded-md border border-cyan-500/40 bg-cyan-500/10 px-3 py-1.5 text-[12px] text-cyan-200 hover:bg-cyan-500/20 disabled:opacity-40"
        onClick={() => run(() => bootstrapCognitiveEngineAction())}
      >
        {pending ? "Analisando…" : "Gerar insights iniciais"}
      </button>
      <button
        type="button"
        disabled={pending}
        data-testid="cognitive-analyze-button"
        className="rounded-md border border-zinc-600 px-3 py-1.5 text-[12px] text-zinc-300 hover:bg-zinc-800 disabled:opacity-40"
        onClick={() => run(() => generateCognitiveArtifactsAction())}
      >
        Atualizar análise
      </button>
    </div>
  );
}
