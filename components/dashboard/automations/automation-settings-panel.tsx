"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  revokePendingConfirmationsAction,
  updateAutomationSettingsAction,
} from "@/app/actions/automation";
import type { AuraBrainSettings } from "@/lib/aura-brain/types";

export function AutomationSettingsPanel({
  settings,
}: {
  settings: AuraBrainSettings;
}) {
  const [pending, start] = useTransition();
  const [allowed, setAllowed] = useState(
    settings.allowedActionTypes.join(", ")
  );
  const [blocked, setBlocked] = useState(
    settings.blockedActionTypes.join(", ")
  );
  const [limit, setLimit] = useState(String(settings.dailyExecutionLimit));
  const [quietStart, setQuietStart] = useState(
    String(settings.quietHours?.startHour ?? "")
  );
  const [quietEnd, setQuietEnd] = useState(
    String(settings.quietHours?.endHour ?? "")
  );

  function save(partial: Parameters<typeof updateAutomationSettingsAction>[0]) {
    start(async () => {
      const res = await updateAutomationSettingsAction(partial);
      if (res.error) toast.error(res.error);
      else toast.success("Configurações salvas");
    });
  }

  return (
    <div className="space-y-4 text-[12px]" data-testid="automation-settings">
      <p className="text-zinc-500">
        Padrões seguros: SUGGEST · AUTO_SAFE desligado · confirmações financeiras
        / externas / destrutivas ativas.
      </p>

      <label className="flex items-center justify-between gap-2 text-zinc-300">
        Permitir AUTO_SAFE
        <input
          type="checkbox"
          disabled={pending}
          defaultChecked={settings.allowAutoSafe}
          onChange={(e) => save({ allowAutoSafe: e.target.checked })}
          data-testid="settings-allow-auto-safe"
        />
      </label>

      <label className="flex items-center justify-between gap-2 text-zinc-300">
        Pausar todas as automações
        <input
          type="checkbox"
          disabled={pending}
          defaultChecked={settings.pauseAllAutomations}
          onChange={(e) => save({ pauseAllAutomations: e.target.checked })}
          data-testid="settings-pause-automations"
        />
      </label>

      <label className="flex items-center justify-between gap-2 text-zinc-300">
        Automações habilitadas
        <input
          type="checkbox"
          disabled={pending}
          defaultChecked={settings.automationsEnabled}
          onChange={(e) => save({ automationsEnabled: e.target.checked })}
        />
      </label>

      <label className="flex items-center justify-between gap-2 text-zinc-300">
        Confirmar financeiro
        <input
          type="checkbox"
          disabled={pending}
          defaultChecked={settings.requireConfirmationForFinancialActions}
          onChange={(e) =>
            save({ requireConfirmationForFinancialActions: e.target.checked })
          }
        />
      </label>

      <label className="flex items-center justify-between gap-2 text-zinc-300">
        Confirmar comunicação externa
        <input
          type="checkbox"
          disabled={pending}
          defaultChecked={
            settings.requireConfirmationForExternalCommunication
          }
          onChange={(e) =>
            save({
              requireConfirmationForExternalCommunication: e.target.checked,
            })
          }
        />
      </label>

      <label className="flex items-center justify-between gap-2 text-zinc-300">
        Confirmar destrutivo
        <input
          type="checkbox"
          disabled={pending}
          defaultChecked={settings.requireConfirmationForDeletion}
          onChange={(e) =>
            save({ requireConfirmationForDeletion: e.target.checked })
          }
        />
      </label>

      <div className="space-y-1">
        <label className="text-zinc-500">Limite diário</label>
        <div className="flex gap-2">
          <input
            value={limit}
            onChange={(e) => setLimit(e.target.value)}
            className="w-24 rounded border border-white/10 bg-zinc-900 px-2 py-1 text-zinc-200"
          />
          <button
            type="button"
            disabled={pending}
            className="text-cyan-400 hover:underline"
            onClick={() =>
              save({ dailyExecutionLimit: Number(limit) || 20 })
            }
          >
            Salvar
          </button>
        </div>
      </div>

      <div className="space-y-1">
        <label className="text-zinc-500">Quiet hours (hora início–fim)</label>
        <div className="flex gap-2">
          <input
            value={quietStart}
            onChange={(e) => setQuietStart(e.target.value)}
            placeholder="22"
            className="w-16 rounded border border-white/10 bg-zinc-900 px-2 py-1 text-zinc-200"
          />
          <input
            value={quietEnd}
            onChange={(e) => setQuietEnd(e.target.value)}
            placeholder="7"
            className="w-16 rounded border border-white/10 bg-zinc-900 px-2 py-1 text-zinc-200"
          />
          <button
            type="button"
            disabled={pending}
            className="text-cyan-400 hover:underline"
            onClick={() => {
              if (quietStart === "" || quietEnd === "") {
                save({ quietHours: null });
              } else {
                save({
                  quietHours: {
                    startHour: Number(quietStart),
                    endHour: Number(quietEnd),
                  },
                });
              }
            }}
          >
            Salvar
          </button>
        </div>
      </div>

      <div className="space-y-1">
        <label className="text-zinc-500">Ações permitidas (csv, vazio = todas)</label>
        <div className="flex gap-2">
          <input
            value={allowed}
            onChange={(e) => setAllowed(e.target.value)}
            className="min-w-0 flex-1 rounded border border-white/10 bg-zinc-900 px-2 py-1 text-zinc-200"
          />
          <button
            type="button"
            disabled={pending}
            className="text-cyan-400 hover:underline"
            onClick={() =>
              save({
                allowedActionTypes: allowed
                  .split(",")
                  .map((s) => s.trim())
                  .filter(Boolean),
              })
            }
          >
            Salvar
          </button>
        </div>
      </div>

      <div className="space-y-1">
        <label className="text-zinc-500">Ações bloqueadas (csv)</label>
        <div className="flex gap-2">
          <input
            value={blocked}
            onChange={(e) => setBlocked(e.target.value)}
            className="min-w-0 flex-1 rounded border border-white/10 bg-zinc-900 px-2 py-1 text-zinc-200"
          />
          <button
            type="button"
            disabled={pending}
            className="text-cyan-400 hover:underline"
            onClick={() =>
              save({
                blockedActionTypes: blocked
                  .split(",")
                  .map((s) => s.trim())
                  .filter(Boolean),
              })
            }
          >
            Salvar
          </button>
        </div>
      </div>

      <button
        type="button"
        disabled={pending}
        data-testid="revoke-pending-confirmations"
        className="rounded border border-amber-500/40 px-3 py-1.5 text-amber-200 hover:bg-amber-950/30"
        onClick={() => {
          start(async () => {
            const res = await revokePendingConfirmationsAction();
            if (res.error) toast.error(res.error);
            else toast.success("Confirmações pendentes revogadas");
          });
        }}
      >
        Revogar confirmações pendentes
      </button>
    </div>
  );
}
