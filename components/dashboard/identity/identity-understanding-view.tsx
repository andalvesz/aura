import Link from "next/link";
import { DashboardCard } from "@/components/dashboard/dashboard-card";
import { IdentityClaimActions } from "@/components/dashboard/identity/identity-claim-actions";
import { IdentityManualEntry } from "@/components/dashboard/identity/identity-manual-entry";
import type { IdentityClaim, IdentityClaimView } from "@/lib/identity/types";
import {
  getIdentityClaims,
  getIdentityProfile,
  explainIdentityClaim,
} from "@/lib/supabase/services/identity-engine.service";

function ClaimRow({
  view,
  explanation,
}: {
  view: IdentityClaimView;
  explanation?: string | null;
}) {
  const c = view.claim;
  return (
    <li
      className="rounded-md border border-white/[0.06] bg-zinc-950/50 p-3"
      data-testid="identity-claim-row"
      data-claim-status={c.status}
      data-claim-key={c.key}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[13px] text-zinc-100">{c.label}</p>
          <p className="text-[11px] text-zinc-500">
            {c.category} · {c.contextScope} · {String(c.value)}
          </p>
          <p className="mt-1 text-[11px] text-zinc-600">{view.explanation}</p>
        </div>
        <div className="text-right text-[10px] text-zinc-500">
          <p>
            {c.status} · {c.confidence}% ({c.confidenceBand})
          </p>
          <p>origem: {c.sourceType}</p>
          <p>atualizado: {c.updatedAt.slice(0, 10)}</p>
        </div>
      </div>
      {explanation ? (
        <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap rounded bg-black/40 p-2 text-[10px] text-zinc-500">
          {explanation}
        </pre>
      ) : null}
      <IdentityClaimActions claim={c} />
    </li>
  );
}

function ClaimList({
  views,
  empty,
}: {
  views: IdentityClaimView[];
  empty: string;
}) {
  if (!views.length) {
    return <p className="text-[12px] text-zinc-600">{empty}</p>;
  }
  return (
    <ul className="space-y-2">
      {views.map((v) => (
        <ClaimRow key={v.claim.id} view={v} />
      ))}
    </ul>
  );
}

function SimpleClaimList({
  claims,
  empty,
}: {
  claims: IdentityClaim[];
  empty: string;
}) {
  if (!claims.length) {
    return <p className="text-[12px] text-zinc-600">{empty}</p>;
  }
  return (
    <ul className="space-y-2">
      {claims.map((c) => (
        <ClaimRow
          key={c.id}
          view={{
            claim: c,
            explanation: `${c.status} · ${c.sourceType}`,
          }}
        />
      ))}
    </ul>
  );
}

export async function IdentityUnderstandingView() {
  const [profile, allClaims] = await Promise.all([
    getIdentityProfile({ bootstrap: true, skipCache: true }),
    getIdentityClaims({ includeRejected: true, includeArchived: true }),
  ]);

  const rejected = allClaims.filter((c) => c.status === "REJECTED");
  const archived = allClaims.filter((c) => c.status === "ARCHIVED");
  const preferences = profile.confirmed.filter(
    (v) =>
      v.claim.category === "preference" ||
      v.claim.category === "communication"
  );
  const skills = profile.confirmed.filter((v) => v.claim.category === "skill");
  const goals = [...profile.confirmed, ...profile.likely].filter(
    (v) => v.claim.category === "goal"
  );
  const lifeContext = [...profile.confirmed, ...profile.likely].filter(
    (v) =>
      v.claim.category === "life_context" ||
      v.claim.category === "role" ||
      v.claim.category === "routine"
  );
  const patterns = [...profile.hypotheses, ...profile.likely].filter(
    (v) => v.claim.category === "behavior_pattern" || v.claim.category === "work_style"
  );

  // Sample explanation for first awaiting claim
  const awaiting = profile.hypotheses[0];
  const explained = awaiting
    ? await explainIdentityClaim(awaiting.claim.id)
    : null;

  return (
    <section className="space-y-4" data-testid="identity-understanding">
      <header className="space-y-1">
        <p className="text-[11px] uppercase tracking-wide text-zinc-500">
          Identidade
        </p>
        <h1 className="text-xl font-semibold text-zinc-100">
          Como o Aura me entende
        </h1>
        <p className="text-sm text-zinc-500">
          Revise afirmações aprendidas. Você é a autoridade final — confirme,
          corrija ou rejeite.
        </p>
        <Link
          href="/dashboard"
          className="inline-block text-[12px] text-zinc-500 hover:text-zinc-300"
        >
          ← Voltar ao Meu Dia
        </Link>
      </header>

      {profile.conflicts.length > 0 ? (
        <DashboardCard
          title="Conflitos"
          status="ok"
          className="border-amber-500/30"
          testId="identity-conflicts"
        >
          <ul className="space-y-2 text-[12px]">
            {profile.conflicts.map((c) => (
              <li key={c.id} className="text-amber-200/90">
                {c.explanation}
              </li>
            ))}
          </ul>
        </DashboardCard>
      ) : null}

      <DashboardCard title="Informações confirmadas" status={profile.confirmed.length ? "ok" : "empty"} emptyTitle="Nada confirmado ainda" testId="identity-confirmed">
        <ClaimList views={profile.confirmed} empty="—" />
      </DashboardCard>

      <DashboardCard title="Preferências" status={preferences.length ? "ok" : "empty"} emptyTitle="Sem preferências confirmadas" testId="identity-preferences">
        <ClaimList views={preferences} empty="—" />
      </DashboardCard>

      <DashboardCard title="Habilidades" status={skills.length ? "ok" : "empty"} emptyTitle="Sem habilidades confirmadas" testId="identity-skills">
        <ClaimList views={skills} empty="—" />
      </DashboardCard>

      <DashboardCard title="Objetivos" status={goals.length ? "ok" : "empty"} emptyTitle="Sem objetivos na identidade" testId="identity-goals">
        <ClaimList views={goals} empty="—" />
      </DashboardCard>

      <DashboardCard title="Contexto atual" status={lifeContext.length ? "ok" : "empty"} emptyTitle="Sem contexto declarado" testId="identity-context">
        <ClaimList views={lifeContext} empty="—" />
      </DashboardCard>

      <DashboardCard title="Possíveis padrões" status={patterns.length ? "ok" : "empty"} emptyTitle="Nenhum padrão em hipótese" testId="identity-patterns">
        <ClaimList views={patterns} empty="—" />
      </DashboardCard>

      <DashboardCard
        title="Aguardando confirmação"
        status={profile.hypotheses.length || profile.likely.length ? "ok" : "empty"}
        emptyTitle="Nada pendente"
        testId="identity-awaiting"
      >
        <ClaimList
          views={[...profile.likely, ...profile.hypotheses]}
          empty="—"
        />
        {explained?.explanation ? (
          <div className="mt-3" data-testid="identity-why">
            <p className="text-[10px] uppercase text-zinc-600">
              Por que o Aura acredita nisso?
            </p>
            <pre className="mt-1 whitespace-pre-wrap text-[11px] text-zinc-500">
              {explained.explanation}
            </pre>
          </div>
        ) : null}
      </DashboardCard>

      <DashboardCard
        title="Informações rejeitadas ou arquivadas"
        status={rejected.length || archived.length ? "ok" : "empty"}
        emptyTitle="Nenhuma"
        testId="identity-rejected-archived"
      >
        <SimpleClaimList claims={[...rejected, ...archived]} empty="—" />
      </DashboardCard>

      <DashboardCard title="Entrada manual (apoio)" status="ok" testId="identity-manual">
        <IdentityManualEntry />
      </DashboardCard>
    </section>
  );
}
