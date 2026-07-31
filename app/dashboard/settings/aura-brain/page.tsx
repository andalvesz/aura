import Link from "next/link";
import { getDataContext } from "@/lib/supabase/services/context";
import {
  getAuraBrainSettings,
  setAuraBrainSettings,
} from "@/lib/aura-brain/context";
import { listActions } from "@/lib/aura-brain/actions/registry";
import { ensureBuiltinActions } from "@/lib/aura-brain/actions/registry";
import { listRecentAudits } from "@/lib/aura-brain/audit";
import { AutonomyControls } from "@/components/dashboard/aura-brain-autonomy-controls";
import { AutomationSettingsPanel } from "@/components/dashboard/automations/automation-settings-panel";
import { PersonalityControls } from "@/components/dashboard/orchestrator/personality-controls";
import { DashboardCard } from "@/components/dashboard/dashboard-card";
import { getOrchestratorSession } from "@/lib/orchestrator";

export default async function AuraBrainSettingsPage() {
  const ctx = await getDataContext();
  ensureBuiltinActions();
  const settings = getAuraBrainSettings(ctx.userId);
  setAuraBrainSettings(ctx.userId, settings);
  const actions = listActions();
  const audits = listRecentAudits(ctx.userId, 15);
  const personality = getOrchestratorSession(ctx.userId).personality;

  return (
    <div
      className="mx-auto max-w-2xl space-y-6 p-4"
      data-testid="aura-brain-settings"
    >
      <header className="space-y-1">
        <p className="text-[11px] uppercase tracking-wide text-zinc-500">
          Configurações
        </p>
        <h1 className="text-lg font-semibold text-zinc-100">Aura Brain</h1>
        <p className="text-[13px] text-zinc-500">
          Seu sistema operacional para vida e negócios — controle de autonomia e
          transparência.
        </p>
        <Link
          href="/dashboard"
          className="text-[12px] text-zinc-500 hover:text-zinc-300"
        >
          ← Voltar ao Aura Home
        </Link>
        <p className="pt-1">
          <Link
            href="/dashboard/automations"
            className="text-[12px] text-teal-400/90 hover:text-teal-300"
            data-testid="link-automation-center"
          >
            Automation Center →
          </Link>
        </p>
        <p className="pt-1">
          <Link
            href="/dashboard/agents"
            className="text-[12px] text-indigo-400/90 hover:text-indigo-300"
            data-testid="link-agent-center"
          >
            Agent Center →
          </Link>
        </p>
        <p className="pt-1">
          <Link
            href="/dashboard/settings/identity"
            className="text-[12px] text-amber-400/90 hover:text-amber-300"
            data-testid="link-identity-understanding"
          >
            Como o Aura me entende →
          </Link>
        </p>
        <p className="pt-1">
          <Link
            href="/dashboard/settings/memory"
            className="text-[12px] text-sky-400/90 hover:text-sky-300"
            data-testid="link-memory-aura"
          >
            Memórias do Aura →
          </Link>
        </p>
        <p className="pt-1">
          <Link
            href="/dashboard/settings/world-model"
            className="text-[12px] text-emerald-400/90 hover:text-emerald-300"
            data-testid="link-world-map"
          >
            Mapa do Aura →
          </Link>
        </p>
        <p className="pt-1">
          <Link
            href="/dashboard/settings/insights"
            className="text-[12px] text-cyan-400/90 hover:text-cyan-300"
            data-testid="link-insights-aura"
          >
            Insights do Aura →
          </Link>
        </p>
        <p className="pt-1">
          <Link
            href="/dashboard/discovery"
            className="text-[12px] text-rose-300/90 hover:text-rose-200"
            data-testid="link-discovery-aura"
          >
            Discovery (descobertas) →
          </Link>
        </p>
      </header>

      <DashboardCard title="Nível de autonomia" status="ok">
        <div className="space-y-3">
          <p className="text-[12px] text-zinc-500">
            Padrão seguro: Sugerir. Ações financeiras, comunicação externa e
            exclusões sempre exigem confirmação.
          </p>
          <AutonomyControls current={settings.defaultAutonomyLevel} />
          <dl className="grid grid-cols-2 gap-2 text-[12px]">
            <div>
              <dt className="text-zinc-500">Limite diário</dt>
              <dd className="text-zinc-200">{settings.dailyExecutionLimit}</dd>
            </div>
            <div>
              <dt className="text-zinc-500">Automações</dt>
              <dd className="text-zinc-200">
                {settings.automationsEnabled ? "ativadas" : "desativadas"}
              </dd>
            </div>
            <div>
              <dt className="text-zinc-500">AUTO_SAFE</dt>
              <dd className="text-zinc-200">
                {settings.allowAutoSafe ? "permitido" : "desligado"}
              </dd>
            </div>
            <div>
              <dt className="text-zinc-500">Pausa global</dt>
              <dd className="text-zinc-200">
                {settings.pauseAllAutomations ? "pausado" : "ativo"}
              </dd>
            </div>
          </dl>
        </div>
      </DashboardCard>

      <DashboardCard title="Personalidade (Sprint 9.0)" status="ok">
        <PersonalityControls initial={personality} />
      </DashboardCard>

      <DashboardCard title="Automações (Sprint 8.1)" status="ok">
        <AutomationSettingsPanel settings={settings} />
      </DashboardCard>

      <DashboardCard title="Ações registradas" status="ok">
        <ul className="space-y-2 text-[12px]">
          {actions.map((a) => (
            <li key={a.id} className="flex justify-between gap-2">
              <span className="text-zinc-200">{a.name}</span>
              <span className="text-zinc-600">
                {a.riskLevel} · {a.autonomySupport}
                {a.autoSafeEligible ? " · AUTO_SAFE" : ""}
              </span>
            </li>
          ))}
        </ul>
      </DashboardCard>

      <DashboardCard
        title="Histórico recente"
        status={audits.length ? "ok" : "empty"}
        emptyTitle="Sem auditoria ainda"
        emptyDescription="Ações do Aura Brain aparecem aqui."
      >
        <ul className="space-y-2 text-[12px]">
          {audits.map((a) => (
            <li key={a.id}>
              <p className="text-zinc-200">
                {a.actionId ?? a.source} · {a.status}
              </p>
              <p className="text-[11px] text-zinc-600">
                {a.autonomyLevel}
                {a.error ? ` · ${a.error}` : ""}
              </p>
            </li>
          ))}
        </ul>
      </DashboardCard>
    </div>
  );
}
