"use client";

import { useTransition } from "react";
import {
  archiveCognitiveArtifactAction,
  confirmCognitiveArtifactAction,
  rejectCognitiveArtifactAction,
  submitCognitiveFeedbackAction,
  suppressSimilarCognitiveAction,
} from "@/app/actions/cognitive";

export function CognitiveArtifactActions({
  artifactId,
}: {
  artifactId: string;
}) {
  const [pending, start] = useTransition();

  const run = (fn: () => Promise<{ error: string | null }>) => {
    start(async () => {
      await fn();
    });
  };

  return (
    <div
      className="mt-2 flex flex-wrap gap-1.5"
      data-testid="cognitive-artifact-actions"
    >
      <button
        type="button"
        disabled={pending}
        className="rounded border border-emerald-500/30 px-2 py-0.5 text-[10px] text-emerald-300/90 hover:bg-emerald-500/10 disabled:opacity-40"
        onClick={() => run(() => confirmCognitiveArtifactAction(artifactId))}
      >
        Confirmar
      </button>
      <button
        type="button"
        disabled={pending}
        className="rounded border border-sky-500/30 px-2 py-0.5 text-[10px] text-sky-300/90 hover:bg-sky-500/10 disabled:opacity-40"
        onClick={() =>
          run(() =>
            submitCognitiveFeedbackAction({
              artifactId,
              kind: "useful",
            })
          )
        }
      >
        Útil
      </button>
      <button
        type="button"
        disabled={pending}
        className="rounded border border-zinc-500/30 px-2 py-0.5 text-[10px] text-zinc-400 hover:bg-zinc-500/10 disabled:opacity-40"
        onClick={() =>
          run(() =>
            submitCognitiveFeedbackAction({
              artifactId,
              kind: "irrelevant",
            })
          )
        }
      >
        Irrelevante
      </button>
      <button
        type="button"
        disabled={pending}
        className="rounded border border-amber-500/30 px-2 py-0.5 text-[10px] text-amber-300/90 hover:bg-amber-500/10 disabled:opacity-40"
        onClick={() =>
          run(() =>
            submitCognitiveFeedbackAction({
              artifactId,
              kind: "needs_more_evidence",
            })
          )
        }
      >
        Pedir evidências
      </button>
      <button
        type="button"
        disabled={pending}
        className="rounded border border-rose-500/30 px-2 py-0.5 text-[10px] text-rose-300/90 hover:bg-rose-500/10 disabled:opacity-40"
        onClick={() =>
          run(() =>
            rejectCognitiveArtifactAction(artifactId, "rejeitado pelo usuário")
          )
        }
      >
        Rejeitar
      </button>
      <button
        type="button"
        disabled={pending}
        className="rounded border border-violet-500/30 px-2 py-0.5 text-[10px] text-violet-300/90 hover:bg-violet-500/10 disabled:opacity-40"
        onClick={() =>
          run(() =>
            suppressSimilarCognitiveAction(artifactId, "silenciar semelhantes")
          )
        }
      >
        Silenciar semelhantes
      </button>
      <button
        type="button"
        disabled={pending}
        className="rounded border border-zinc-600/40 px-2 py-0.5 text-[10px] text-zinc-500 hover:bg-zinc-800 disabled:opacity-40"
        onClick={() => run(() => archiveCognitiveArtifactAction(artifactId))}
      >
        Arquivar
      </button>
    </div>
  );
}
