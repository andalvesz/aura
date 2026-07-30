import Link from "next/link";
import { DashboardCard } from "@/components/dashboard/dashboard-card";
import { CognitiveArtifactActions } from "@/components/dashboard/cognitive/cognitive-artifact-actions";
import { CognitiveBootstrapButton } from "@/components/dashboard/cognitive/cognitive-bootstrap-button";
import type { CognitiveArtifact, CognitiveArtifactType } from "@/lib/cognitive/types";
import {
  bootstrapCognitiveEngine,
  explainCognitiveArtifactService,
  listCognitiveArtifacts,
} from "@/lib/supabase/services/cognitive-engine.service";
import { getDataContext } from "@/lib/supabase/services/context";

const SECTIONS: Array<{
  key: string;
  title: string;
  types?: CognitiveArtifactType[];
  statuses?: CognitiveArtifact["status"][];
}> = [
  { key: "patterns", title: "Padrões observados", types: ["PATTERN"] },
  { key: "insights", title: "Insights", types: ["INSIGHT"] },
  { key: "hypotheses", title: "Hipóteses", types: ["HYPOTHESIS"] },
  {
    key: "progress",
    title: "Progresso",
    types: ["PROGRESS_OBSERVATION"],
  },
  { key: "conflicts", title: "Conflitos", types: ["CONFLICT"] },
  {
    key: "recommendations",
    title: "Recomendações",
    types: ["RECOMMENDATION"],
  },
  {
    key: "review",
    title: "Aguardando revisão",
    statuses: ["PENDING_REVIEW", "GENERATED", "VALIDATED"],
  },
  { key: "confirmed", title: "Confirmados", statuses: ["CONFIRMED", "CORRECTED"] },
  { key: "rejected", title: "Rejeitados", statuses: ["REJECTED"] },
  {
    key: "archived",
    title: "Arquivados",
    statuses: ["ARCHIVED", "OUTDATED", "SUPERSEDED"],
  },
];

function ArtifactCard({
  artifact,
  explanation,
}: {
  artifact: CognitiveArtifact;
  explanation?: string | null;
}) {
  return (
    <li
      className="rounded-md border border-white/[0.06] bg-zinc-950/50 p-3"
      data-testid="cognitive-artifact-row"
      data-artifact-type={artifact.artifactType}
      data-artifact-status={artifact.status}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[13px] text-zinc-100">{artifact.title}</p>
          <p className="mt-1 text-[12px] text-zinc-400">{artifact.summary}</p>
          <p className="mt-1 text-[11px] text-zinc-500">
            {artifact.artifactType} · {artifact.category}
          </p>
          {artifact.limitations.length ? (
            <p className="mt-1 text-[10px] text-zinc-600">
              Limitações: {artifact.limitations.slice(0, 2).join(" · ")}
            </p>
          ) : null}
          {artifact.alternativeHypotheses.length ? (
            <p className="mt-1 text-[10px] text-zinc-600">
              Alternativa: {artifact.alternativeHypotheses[0]?.statement}
            </p>
          ) : null}
        </div>
        <div className="text-right text-[10px] text-zinc-500">
          <p>
            {artifact.status} · {artifact.confidence}%
          </p>
          <p>
            período:{" "}
            {artifact.timeRange.label ??
              `${artifact.timeRange.from ?? "—"} → ${artifact.timeRange.to ?? "—"}`}
          </p>
          <p>método: {artifact.method}</p>
          {artifact.providerMetadata?.used ? (
            <p>modelo: {artifact.providerMetadata.provider}</p>
          ) : (
            <p>origem: determinístico</p>
          )}
          <p data-testid="execution-influence-none">
            execução: {artifact.executionInfluence}
          </p>
        </div>
      </div>
      {artifact.evidence.length ? (
        <details className="mt-2">
          <summary className="cursor-pointer text-[10px] text-zinc-500">
            Evidências ({artifact.evidence.length})
          </summary>
          <ul className="mt-1 space-y-0.5 text-[10px] text-zinc-600">
            {artifact.evidence.slice(0, 5).map((e) => (
              <li key={e.id}>
                [{e.sourceLayer}] {e.summary}
              </li>
            ))}
          </ul>
        </details>
      ) : null}
      {explanation ? (
        <details className="mt-2">
          <summary className="cursor-pointer text-[10px] text-cyan-500/80">
            Explicar
          </summary>
          <pre className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap rounded bg-black/40 p-2 text-[10px] text-zinc-500">
            {explanation}
          </pre>
        </details>
      ) : null}
      <details className="mt-1">
        <summary className="cursor-pointer text-[10px] text-zinc-600">
          Avançado
        </summary>
        <p className="mt-1 text-[10px] text-zinc-600">
          versão {artifact.methodVersion} · fingerprint{" "}
          {artifact.fingerprint.slice(0, 12)} · evidenceSet{" "}
          {artifact.evidenceSetHash.slice(0, 10)}
        </p>
      </details>
      <CognitiveArtifactActions artifactId={artifact.id} />
    </li>
  );
}

export async function InsightsAuraView() {
  await getDataContext();
  const existing = await listCognitiveArtifacts({ limit: 1 });
  if (existing.length === 0) {
    await bootstrapCognitiveEngine({ maxItems: 20 });
  }

  const all = await listCognitiveArtifacts({ limit: 100, includeArchived: true });
  const explanations = new Map<string, string>();
  for (const a of all.slice(0, 12)) {
    const exp = await explainCognitiveArtifactService(a.id);
    if (exp) {
      explanations.set(
        a.id,
        [
          `Observado: ${exp.observed}`,
          `Período: ${exp.period}`,
          `Confiança: ${exp.confidence}% (${exp.confidenceBand})`,
          `Limitações: ${exp.limitations.join("; ") || "—"}`,
          `Premissas: ${exp.premises.join("; ") || "—"}`,
          `Justificativa: ${exp.justificationSummary}`,
          `Ação gerada: não`,
          `executionInfluence: ${exp.executionInfluence}`,
        ].join("\n")
      );
    }
  }

  const overview = {
    total: all.filter((a) => a.status !== "DELETED").length,
    patterns: all.filter((a) => a.artifactType === "PATTERN").length,
    insights: all.filter((a) => a.artifactType === "INSIGHT").length,
    pending: all.filter((a) =>
      ["PENDING_REVIEW", "GENERATED", "VALIDATED"].includes(a.status)
    ).length,
  };

  return (
    <div className="space-y-6" data-testid="insights-aura-view">
      <header className="space-y-2">
        <p className="text-[11px] uppercase tracking-wide text-zinc-500">
          Aura Brain
        </p>
        <h1 className="text-lg font-semibold text-zinc-100">Insights do Aura</h1>
        <p className="text-[13px] text-zinc-500">
          Padrões, hipóteses e recomendações revisáveis — sem execução
          automática.
        </p>
        <div className="flex flex-wrap gap-3 text-[12px]">
          <Link
            href="/dashboard/settings/aura-brain"
            className="text-zinc-500 hover:text-zinc-300"
          >
            ← Aura Brain
          </Link>
          <Link
            href="/dashboard/settings/world-model"
            className="text-emerald-400/80 hover:text-emerald-300"
          >
            Mapa do Aura
          </Link>
          <Link
            href="/dashboard/settings/memory"
            className="text-sky-400/80 hover:text-sky-300"
          >
            Memórias
          </Link>
          <Link
            href="/dashboard/settings/identity"
            className="text-amber-400/80 hover:text-amber-300"
          >
            Identidade
          </Link>
        </div>
        <CognitiveBootstrapButton />
      </header>

      <DashboardCard title="Visão geral" status="ok">
        <dl className="grid grid-cols-2 gap-2 text-[12px] sm:grid-cols-4">
          <div>
            <dt className="text-zinc-500">Artefatos</dt>
            <dd className="text-zinc-200">{overview.total}</dd>
          </div>
          <div>
            <dt className="text-zinc-500">Padrões</dt>
            <dd className="text-zinc-200">{overview.patterns}</dd>
          </div>
          <div>
            <dt className="text-zinc-500">Insights</dt>
            <dd className="text-zinc-200">{overview.insights}</dd>
          </div>
          <div>
            <dt className="text-zinc-500">Em revisão</dt>
            <dd className="text-zinc-200">{overview.pending}</dd>
          </div>
        </dl>
        <p className="mt-2 text-[11px] text-zinc-600">
          Influência em execução: none · Correlação ≠ causalidade · Insight ≠
          decisão
        </p>
      </DashboardCard>

      {SECTIONS.map((section) => {
        const items = all.filter((a) => {
          if (section.types && !section.types.includes(a.artifactType)) {
            return false;
          }
          if (section.statuses && !section.statuses.includes(a.status)) {
            return false;
          }
          if (section.key === "archived") {
            return (
              a.status === "ARCHIVED" ||
              a.status === "OUTDATED" ||
              a.status === "SUPERSEDED" ||
              a.archivedAt != null
            );
          }
          if (section.key === "rejected") return a.status === "REJECTED";
          if (section.key === "confirmed") {
            return a.status === "CONFIRMED" || a.status === "CORRECTED";
          }
          if (section.key === "review") {
            return ["PENDING_REVIEW", "GENERATED", "VALIDATED"].includes(
              a.status
            );
          }
          return a.status !== "DELETED" && a.status !== "ARCHIVED";
        });

        return (
          <DashboardCard
            key={section.key}
            title={section.title}
            status="ok"
            testId={`cognitive-section-${section.key}`}
          >
            {items.length === 0 ? (
              <p className="text-[12px] text-zinc-600">
                Nenhum insight ainda. Atualize descobertas após registrar
                memórias — o Aura só mostra hipóteses, não decisões.
              </p>
            ) : (
              <ul className="space-y-2">
                {items.slice(0, 12).map((a) => (
                  <ArtifactCard
                    key={`${section.key}-${a.id}`}
                    artifact={a}
                    explanation={explanations.get(a.id)}
                  />
                ))}
              </ul>
            )}
          </DashboardCard>
        );
      })}
    </div>
  );
}
