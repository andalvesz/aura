import Link from "next/link";
import type {
  DiscoveryArtifact,
  DiscoveryExplanation,
} from "@/lib/discovery/types";
import { DiscoveryArtifactActions } from "@/components/dashboard/discovery/discovery-artifact-actions";
import { CommentsPanel } from "@/components/dashboard/daily/comments-panel";
import { FavoriteButton } from "@/components/dashboard/daily/favorites-client";

export function DiscoveryDetailPanel({
  artifact,
  explanation,
}: {
  artifact: DiscoveryArtifact;
  explanation: DiscoveryExplanation | null;
}) {
  return (
    <section
      className="rounded-md border border-cyan-500/20 bg-zinc-950/80 p-4"
      data-testid="discovery-detail"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-[11px] uppercase tracking-wide text-cyan-500/80">
            Detalhe · {artifact.type}
          </p>
          <h2 className="text-[15px] text-zinc-100">{artifact.title}</h2>
          <p className="mt-1 text-[12px] text-zinc-400">{artifact.description}</p>
        </div>
        <div className="text-right text-[10px] text-zinc-500">
          <p>
            {artifact.confidence}% · {artifact.confidenceBand}
          </p>
          <p>
            impacto {artifact.impact} · urgência {artifact.urgency}
          </p>
          <p data-testid="execution-influence-none">
            execução: {artifact.executionInfluence}
          </p>
          <div className="mt-2">
            <FavoriteButton
              targetType="discovery"
              targetId={artifact.id}
              title={artifact.title}
              href={`/dashboard/discovery?id=${artifact.id}`}
            />
          </div>
        </div>
      </div>

      <DiscoveryArtifactActions
        artifactId={artifact.id}
        rowVersion={artifact.rowVersion}
      />

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <div>
          <h3 className="text-[11px] font-medium text-zinc-400">Evidências</h3>
          <ul className="mt-1 space-y-1 text-[11px] text-zinc-500">
            {artifact.evidence.length === 0 ? (
              <li>Sem evidências</li>
            ) : (
              artifact.evidence.map((e) => (
                <li key={e.id}>
                  [{e.sourceLayer}] {e.summary}
                </li>
              ))
            )}
          </ul>
        </div>

        <div>
          <h3 className="text-[11px] font-medium text-zinc-400">Explicação</h3>
          <p className="mt-1 text-[11px] text-zinc-500">
            {artifact.explanation}
          </p>
        </div>

        <div>
          <h3 className="text-[11px] font-medium text-zinc-400">Entidades</h3>
          <ul className="mt-1 space-y-1 text-[11px]">
            {artifact.relatedEntities.length === 0 ? (
              <li className="text-zinc-600">—</li>
            ) : (
              artifact.relatedEntities.map((r) => (
                <li key={r.entityId}>
                  <Link
                    href={`/dashboard/settings/world-model#${r.entityId}`}
                    className="text-cyan-400/90 hover:underline"
                  >
                    {r.entityType}:{r.entityId.slice(0, 10)}
                  </Link>
                </li>
              ))
            )}
          </ul>
        </div>

        <div>
          <h3 className="text-[11px] font-medium text-zinc-400">
            Insights relacionados
          </h3>
          <ul className="mt-1 space-y-1 text-[11px]">
            {artifact.relatedInsights.length === 0 ? (
              <li className="text-zinc-600">—</li>
            ) : (
              artifact.relatedInsights.map((r) => (
                <li key={r.entityId}>
                  <Link
                    href={`/dashboard/settings/insights#${r.entityId}`}
                    className="text-cyan-400/90 hover:underline"
                  >
                    {r.entityId.slice(0, 12)}
                  </Link>
                </li>
              ))
            )}
          </ul>
        </div>

        <div>
          <h3 className="text-[11px] font-medium text-zinc-400">
            Memórias relacionadas
          </h3>
          <ul className="mt-1 space-y-1 text-[11px]">
            {artifact.relatedMemories.length === 0 ? (
              <li className="text-zinc-600">—</li>
            ) : (
              artifact.relatedMemories.map((r) => (
                <li key={r.entityId}>
                  <Link
                    href={`/dashboard/settings/memory#${r.entityId}`}
                    className="text-cyan-400/90 hover:underline"
                  >
                    {r.entityId.slice(0, 12)}
                  </Link>
                </li>
              ))
            )}
          </ul>
        </div>

        <div>
          <h3 className="text-[11px] font-medium text-zinc-400">
            Interpretações alternativas
          </h3>
          <ul className="mt-1 space-y-1 text-[11px] text-zinc-500">
            {artifact.alternativeInterpretations.map((alt) => (
              <li key={alt}>· {alt}</li>
            ))}
          </ul>
        </div>

        <div>
          <h3 className="text-[11px] font-medium text-zinc-400">Limitações</h3>
          <ul className="mt-1 space-y-1 text-[11px] text-zinc-500">
            {artifact.limitations.map((l) => (
              <li key={l}>· {l}</li>
            ))}
          </ul>
        </div>

        <div>
          <h3 className="text-[11px] font-medium text-zinc-400">Histórico</h3>
          <ul className="mt-1 space-y-1 text-[11px] text-zinc-500">
            {(explanation?.history ?? []).length === 0 ? (
              <li>Sem eventos ainda</li>
            ) : (
              explanation!.history.map((h, i) => (
                <li key={`${h.action}-${i}`}>
                  {new Date(h.at).toLocaleString("pt-BR")} · {h.action} —{" "}
                  {h.justification}
                </li>
              ))
            )}
          </ul>
        </div>
      </div>

      <div className="mt-4">
        <CommentsPanel
          targetType="discovery"
          targetId={artifact.id}
          shareWithWorkspace={Boolean(artifact.workspaceId)}
        />
      </div>
    </section>
  );
}
