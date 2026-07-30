"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import type { AutonomyLevel } from "@/lib/aura-brain/types";
import { updateAuraBrainAutonomyAction } from "@/app/actions/aura-brain";
import { ActionButton } from "@/components/dashboard/action-button";

const LEVELS: { id: AutonomyLevel; label: string }[] = [
  { id: "SUGGEST", label: "Sugerir" },
  { id: "PREPARE", label: "Preparar" },
  { id: "CONFIRM", label: "Confirmar" },
  { id: "AUTO_SAFE", label: "Auto seguro" },
];

export function AutonomyControls({ current }: { current: AutonomyLevel }) {
  const [pending, start] = useTransition();

  return (
    <div className="flex flex-wrap gap-1.5" data-testid="aura-brain-autonomy">
      {LEVELS.map((l) => (
        <ActionButton
          key={l.id}
          type="button"
          variant={current === l.id ? "primary" : "ghost"}
          disabled={pending}
          onClick={() => {
            start(async () => {
              const r = await updateAuraBrainAutonomyAction(l.id);
              if (r.error) toast.error(r.error);
              else toast.success(`Autonomia: ${l.label}`);
            });
          }}
        >
          {l.label}
        </ActionButton>
      ))}
    </div>
  );
}
