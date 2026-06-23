"use client";

import { AlertTriangle, Brain, CheckCircle2, ShieldAlert, Sparkles, Target } from "lucide-react";
import { useEffect, useState } from "react";
import { Panel, PanelContent, PanelHeader, PanelTitle } from "@/components/dashboard/panel";
import type { AppliedKnowledge } from "@/utils/knowledge-sources";
import { hasAppliedKnowledge } from "@/utils/knowledge-sources";
import type { ExpertInfluenceAudit } from "@/utils/expert-influence";
import { INFLUENCE_WARNING_THRESHOLD } from "@/utils/expert-influence";
import { parseJsonResponse } from "@/utils/safe-json";
import { cn } from "@/utils/cn";

type AppliedKnowledgePanelProps = {
  module: string;
  applied?: AppliedKnowledge | null;
  audit?: ExpertInfluenceAudit | null;
  className?: string;
};

function KnowledgeChip({ label }: { label: string }) {
  return (
    <span className="rounded border border-violet-500/20 bg-violet-500/[0.06] px-2 py-0.5 text-[10px] text-violet-200">
      {label}
    </span>
  );
}

function Section({
  title,
  icon: Icon,
  items,
  accent,
}: {
  title: string;
  icon: typeof Brain;
  items: string[];
  accent: string;
}) {
  if (!items.length) return null;
  return (
    <div className="space-y-1.5">
      <p className={cn("flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wide", accent)}>
        <Icon className="size-3" />
        {title}
      </p>
      <div className="flex flex-wrap gap-1">
        {items.map((item) => (
          <KnowledgeChip key={item} label={item} />
        ))}
      </div>
    </div>
  );
}

export function AppliedKnowledgePanel({ module, applied, audit, className }: AppliedKnowledgePanelProps) {
  const [fetchedKnowledge, setFetchedKnowledge] = useState<AppliedKnowledge | null>(null);
  const [fetchedAudit, setFetchedAudit] = useState<ExpertInfluenceAudit | null>(null);

  useEffect(() => {
    if (applied && audit) return;
    void (async () => {
      const res = await fetch(`/api/expert-brain/influence?module=${encodeURIComponent(module)}`);
      const { data } = await parseJsonResponse<{
        appliedKnowledge?: AppliedKnowledge | null;
        audit?: ExpertInfluenceAudit | null;
      }>(res);
      if (data?.appliedKnowledge) setFetchedKnowledge(data.appliedKnowledge);
      if (data?.audit) setFetchedAudit(data.audit);
    })();
  }, [module, applied, audit]);

  const knowledge = applied ?? fetchedKnowledge;
  const influence = audit ?? fetchedAudit;

  if (!knowledge || !hasAppliedKnowledge(knowledge)) {
    if (!influence || influence.influenceScore === 0) return null;
  }

  const showWarning =
    influence?.belowTarget || (influence && influence.influenceScore < INFLUENCE_WARNING_THRESHOLD);

  return (
    <Panel className={className}>
      <PanelHeader>
        <PanelTitle className="flex items-center justify-between gap-2 text-[13px]">
          <span className="flex items-center gap-2">
            <Sparkles className="size-3.5 text-violet-400" />
            Conhecimento aplicado
          </span>
          {influence && (
            <span
              className={cn(
                "text-[11px] font-semibold",
                showWarning ? "text-amber-400" : "text-emerald-400"
              )}
            >
              Score {influence.influenceScore.toFixed(0)}
            </span>
          )}
        </PanelTitle>
      </PanelHeader>
      <PanelContent className="space-y-3">
        {showWarning && influence?.warning && (
          <div className="flex items-start gap-2 rounded-md border border-amber-500/20 bg-amber-500/[0.04] px-2 py-1.5">
            <AlertTriangle className="mt-0.5 size-3 shrink-0 text-amber-400" />
            <p className="text-[10px] text-amber-200">{influence.warning}</p>
          </div>
        )}
        {knowledge && (
          <>
            <Section title="Frameworks" icon={Brain} items={knowledge.frameworks} accent="text-violet-400" />
            <Section title="Decision rules" icon={Target} items={knowledge.decisionRules} accent="text-sky-400" />
            <Section title="Patterns" icon={Sparkles} items={knowledge.patterns} accent="text-amber-400" />
            <Section
              title="Success patterns"
              icon={CheckCircle2}
              items={knowledge.successPatterns}
              accent="text-emerald-400"
            />
            <Section
              title="Failure patterns"
              icon={ShieldAlert}
              items={knowledge.failurePatterns}
              accent="text-red-400"
            />
          </>
        )}
      </PanelContent>
    </Panel>
  );
}
