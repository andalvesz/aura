/**
 * Step Sequencing Engine — orders steps and wires linear dependsOn by temp keys.
 */

import type { PlannerEngine } from "@/lib/planner/types/types";

export const stepSequencingEngine: PlannerEngine = {
  id: "step_sequencing_v1",
  label: "Step Sequencing",
  description: "Ordena etapas e sugere sequência linear — sem executar.",
  enrich(draft) {
    const sorted = [...draft.steps]
      .sort((a, b) => a.order - b.order)
      .map((s, i) => ({ ...s, order: i }));

    // Use placeholder keys step_0.. for dependsOn wiring before ids exist
    const sequenced = sorted.map((s, i) => ({
      ...s,
      dependsOn:
        i === 0
          ? []
          : s.dependsOn.length
            ? s.dependsOn
            : [`__seq_${i - 1}`],
      _seqKey: `__seq_${i}`,
    }));

    return {
      ...draft,
      steps: sequenced.map(({ _seqKey: _, ...rest }) => rest),
      // Store seq markers in dependsOn temporarily as __seq_N; resolved in generation
      pipelineSteps: [...draft.pipelineSteps, "step_sequencing"],
      assumptions: [
        ...draft.assumptions,
        "Sequência linear sugerida; o usuário pode reordenar.",
      ],
    };
  },
};
