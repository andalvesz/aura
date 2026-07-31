"use client";

import { useState, useTransition } from "react";
import {
  createBetaInviteAction,
  createReleaseAction,
  publishReleaseAction,
  upsertRolloutAction,
  triageFeedbackAction,
  getSupportViewAction,
} from "@/app/actions/beta-ops";
import type { AdminBetaDashboard } from "@/lib/beta-ops/admin-dashboard";
import type { BetaCohortId } from "@/lib/beta-ops/types";

type Props = {
  dashboard: AdminBetaDashboard;
  invites: Array<{
    id: string;
    email: string;
    status: string;
    cohort: string;
    expiresAt: string;
  }>;
};

export function AdminBetaOpsPanel({ dashboard, invites }: Props) {
  const [email, setEmail] = useState("");
  const [cohort, setCohort] = useState<BetaCohortId>("PERSONAL_USERS");
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [supportJson, setSupportJson] = useState<string | null>(null);
  const [pending, start] = useTransition();

  return (
    <div className="space-y-6" data-testid="admin-beta-ops">
      <section className="space-y-2 border border-white/[0.06] p-3">
        <h2 className="text-[13px] font-medium text-zinc-200">Convites beta</h2>
        <div className="flex flex-wrap gap-2">
          <input
            className="flex-1 rounded border border-white/[0.08] bg-zinc-900 px-2 py-1 text-[12px]"
            placeholder="email@exemplo.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            data-testid="admin-invite-email"
          />
          <select
            className="rounded border border-white/[0.08] bg-zinc-900 px-2 py-1 text-[12px]"
            value={cohort}
            onChange={(e) => setCohort(e.target.value as BetaCohortId)}
            data-testid="admin-invite-cohort"
          >
            {dashboard.cohorts.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={pending || !email}
            className="rounded bg-zinc-100 px-2 py-1 text-[12px] text-zinc-900"
            data-testid="admin-invite-submit"
            onClick={() =>
              start(async () => {
                const res = await createBetaInviteAction({ email, cohort });
                if (!res.ok) {
                  setMsg(res.error ?? "erro");
                  return;
                }
                const d = res.data as { acceptUrl: string };
                setInviteUrl(d.acceptUrl);
                setMsg("Convite criado");
              })
            }
          >
            Convidar
          </button>
        </div>
        {inviteUrl && (
          <p className="break-all text-[11px] text-zinc-500" data-testid="admin-invite-url">
            {inviteUrl}
          </p>
        )}
        <ul className="space-y-1 text-[11px] text-zinc-500">
          {invites.slice(0, 20).map((i) => (
            <li key={i.id}>
              {i.email} · {i.status} · {i.cohort}
            </li>
          ))}
        </ul>
        <p className="text-[11px] text-zinc-600">
          Pendentes: {dashboard.invites.pending} · Aceitos: {dashboard.invites.accepted}
        </p>
      </section>

      <section className="grid gap-3 sm:grid-cols-2" data-testid="admin-beta-metrics">
        <Metric label="Usuários ativos (beta)" value={String(dashboard.users.byStatus.ACTIVE)} />
        <Metric label="Onboarding incompleto" value={String(dashboard.onboardingIncomplete)} />
        <Metric label="Feedbacks" value={String(dashboard.feedback.total)} />
        <Metric label="Bugs" value={String(dashboard.feedback.bugs)} />
        <Metric label="Erros abertos" value={String(dashboard.recentErrors.length)} />
        <Metric
          label="First value (avg ms)"
          value={String(dashboard.retention.firstValueAvgMs ?? "—")}
        />
      </section>

      <section className="space-y-2 border border-white/[0.06] p-3">
        <h2 className="text-[13px] font-medium text-zinc-200">Rollout / Release</h2>
        <button
          type="button"
          className="mr-2 rounded border border-white/[0.1] px-2 py-1 text-[11px]"
          data-testid="admin-rollout-sample"
          onClick={() =>
            start(async () => {
              await upsertRolloutAction({
                key: "beta.sample_feature",
                percent: 50,
                reason: "gradual beta",
                cohorts: ["FOUNDERS"],
              });
              setMsg("Rollout 50%");
            })
          }
        >
          Rollout 50% sample
        </button>
        <button
          type="button"
          className="rounded border border-white/[0.1] px-2 py-1 text-[11px]"
          data-testid="admin-publish-release"
          onClick={() =>
            start(async () => {
              const created = await createReleaseAction({
                version: `10.2.${Date.now().toString(36)}`,
                channel: "BETA",
                title: "Correção beta",
                summary: "Correções e melhorias da operação privada.",
                changes: [{ kind: "fix", text: "Feedback e invites" }],
                knownIssues: [],
              });
              if (created.ok && created.data) {
                await publishReleaseAction((created.data as { id: string }).id);
                setMsg("Release publicada");
              }
            })
          }
        >
          Publicar release
        </button>
      </section>

      <section className="space-y-2 border border-white/[0.06] p-3">
        <h2 className="text-[13px] font-medium text-zinc-200">Support Mode</h2>
        <p className="text-[11px] text-zinc-500">
          Sem impersonação. Sem memórias, documentos ou conversas.
        </p>
        <button
          type="button"
          className="rounded border border-white/[0.1] px-2 py-1 text-[11px]"
          data-testid="admin-support-self"
          onClick={() =>
            start(async () => {
              // Uses admin's own id as target for smoke — still no private content
              const res = await getSupportViewAction(
                (typeof window !== "undefined" &&
                  (window as unknown as { __AURA_ADMIN_UID?: string }).__AURA_ADMIN_UID) ||
                  "support-target"
              );
              setSupportJson(JSON.stringify(res.data ?? res.error, null, 2));
            })
          }
        >
          Ver support view (alvo)
        </button>
        {supportJson && (
          <pre className="max-h-40 overflow-auto text-[10px] text-zinc-500">{supportJson}</pre>
        )}
      </section>

      {dashboard.feedback.newCount > 0 && (
        <section className="text-[12px] text-zinc-400">
          <button
            type="button"
            className="underline"
            onClick={() =>
              start(async () => {
                setMsg("Use triageFeedbackAction via API admin");
                await triageFeedbackAction({
                  feedbackId: "noop",
                  status: "TRIAGED",
                });
              })
            }
          >
            {dashboard.feedback.newCount} feedbacks novos
          </button>
        </section>
      )}

      {msg && <p className="text-[11px] text-zinc-500">{msg}</p>}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-white/[0.06] px-3 py-2">
      <p className="text-[10px] uppercase tracking-wide text-zinc-500">{label}</p>
      <p className="text-[16px] text-zinc-100">{value}</p>
    </div>
  );
}
