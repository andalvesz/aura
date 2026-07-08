"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Search, Target } from "lucide-react";
import { toast } from "sonner";
import { ActionButton } from "@/components/dashboard/action-button";
import { EmptyState } from "@/components/dashboard/empty-state";
import { Panel, PanelContent, PanelHeader, PanelTitle } from "@/components/dashboard/panel";
import { OpportunityRecommendationExperience } from "@/components/dashboard/modules/opportunity-recommendation";
import { useMissionCore } from "@/hooks/use-mission-core";
import { useOpportunityEngine } from "@/hooks/use-opportunity-engine";

export function OpportunitiesView() {
  const router = useRouter();
  const { opportunities, reasoning, reality, comparison, recommendationSummary, loading, error, lastGoal, search } =
    useOpportunityEngine();
  const { startMission, running: creatingMission } = useMissionCore();
  const [goal, setGoal] = useState("");

  async function handleSearch() {
    await search(goal);
  }

  async function handleCreateMission() {
    const primary = opportunities[0];
    if (!primary) return;

    const ok = await startMission({
      raw: lastGoal ?? goal,
      niche: primary.niche,
      avatar: primary.avatar,
      ticket: primary.price,
    });

    if (!ok) {
      toast.error("Não foi possível criar a missão. Tente novamente.");
      return;
    }

    toast.success(`Missão criada: ${primary.recommendedProduct}`);
    router.push("/dashboard/master-flow");
  }

  return (
    <div className="space-y-4">
      <Panel>
        <PanelHeader>
          <PanelTitle className="flex items-center gap-2">
            <Target className="size-3.5 text-emerald-400" />
            O que eu faço agora?
          </PanelTitle>
        </PanelHeader>
        <PanelContent className="space-y-3">
          <input
            type="text"
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void handleSearch();
            }}
            placeholder="Ex: Tenho R$500, 2h por dia — quero ganhar R$5.000 com IA para pequenos negócios"
            className="w-full rounded-md border border-white/[0.08] bg-white/[0.03] px-3 py-2.5 text-[13px] text-zinc-100 placeholder:text-zinc-600 focus:border-emerald-500/40 focus:outline-none"
          />
          <ActionButton
            variant="primary"
            onClick={() => void handleSearch()}
            disabled={loading || !goal.trim()}
            className="gap-2"
          >
            {loading ? <Loader2 className="size-3.5 animate-spin" /> : <Search className="size-3.5" />}
            Buscar oportunidades
          </ActionButton>
          {error ? <p className="text-[12px] text-red-400">{error}</p> : null}
        </PanelContent>
      </Panel>

      {opportunities.length > 0 ? (
        <OpportunityRecommendationExperience
          opportunities={opportunities}
          reasoning={reasoning}
          reality={reality}
          comparison={comparison}
          recommendationSummary={recommendationSummary}
          onCreateMission={handleCreateMission}
          creatingMission={creatingMission}
        />
      ) : !loading && !error ? (
        <EmptyState
          title="Seu conselheiro de negócios"
          description="Descreva sua situação e meta. O Aura responde com o melhor caminho viável para você — não apenas o melhor negócio em teoria."
        />
      ) : null}
    </div>
  );
}
