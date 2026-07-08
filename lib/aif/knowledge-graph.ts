import type { ExpertBrainCategory } from "@/types/database";
import {
  AIF_FUNNEL_CHAIN,
  createAifId,
  type AifGraphEdge,
  type AifGraphNode,
  type AifKnowledgeGraph,
} from "@/utils/aif";
import type { AifExtractionDraft } from "./knowledge-extractor";

const CATEGORY_TO_FUNNEL: Partial<Record<ExpertBrainCategory, string>> = {
  offer_creation: "funnel-offer",
  landing_page: "funnel-landing",
  copywriting: "funnel-copy",
  creative_strategy: "funnel-creative",
  paid_traffic: "funnel-conversion",
  funnel_strategy: "funnel-landing",
};

function entityNodeType(
  type: "framework" | "checklist" | "decision_rule" | "kpi" | "case" | "principle" | "mental_model" | "anti_pattern" | "concept"
): AifGraphNode["nodeType"] {
  return type;
}

export function buildAifFunnelChainNodes(): AifGraphNode[] {
  return AIF_FUNNEL_CHAIN.map((step) => ({
    id: step.id,
    label: step.label,
    nodeType: step.nodeType,
    entityId: null,
    category: null,
  }));
}

export function buildAifKnowledgeGraph(draft: AifExtractionDraft): AifKnowledgeGraph {
  const nodes: AifGraphNode[] = [...buildAifFunnelChainNodes()];
  const edges: AifGraphEdge[] = [];

  for (let i = 0; i < AIF_FUNNEL_CHAIN.length - 1; i++) {
    const from = AIF_FUNNEL_CHAIN[i].id;
    const to = AIF_FUNNEL_CHAIN[i + 1].id;
    edges.push({
      id: createAifId("edge", `${from}-${to}`),
      from,
      to,
      relation: "influences",
      weight: 1,
    });
  }

  const entityGroups: Array<{
    type: AifGraphNode["nodeType"];
    items: Array<{ id: string; name: string; category: ExpertBrainCategory }>;
  }> = [
    { type: "framework", items: draft.frameworks },
    { type: "checklist", items: draft.checklists },
    { type: "decision_rule", items: draft.decisionRules },
    { type: "kpi", items: draft.kpis },
    { type: "case", items: draft.cases },
    { type: "principle", items: draft.principles },
    { type: "mental_model", items: draft.mentalModels },
    { type: "anti_pattern", items: draft.antiPatterns },
    { type: "concept", items: draft.concepts },
  ];

  for (const group of entityGroups) {
    for (const item of group.items) {
      nodes.push({
        id: item.id,
        label: item.name,
        nodeType: entityNodeType(group.type as Parameters<typeof entityNodeType>[0]),
        entityId: item.id,
        category: item.category,
      });

      const funnelNode = CATEGORY_TO_FUNNEL[item.category];
      if (funnelNode) {
        edges.push({
          id: createAifId("edge", `${item.id}-${funnelNode}`),
          from: item.id,
          to: funnelNode,
          relation: group.type === "anti_pattern" ? "blocks" : "implements",
          weight: group.type === "decision_rule" ? 0.9 : 0.7,
        });
      }

      if (group.type === "kpi" && funnelNode === "funnel-conversion") {
        edges.push({
          id: createAifId("edge", `${item.id}-measures`),
          from: item.id,
          to: "funnel-conversion",
          relation: "measures",
          weight: 0.85,
        });
      }
    }
  }

  for (const rule of draft.decisionRules) {
    const fw = draft.frameworks.find(
      (f) => f.name.toLowerCase() === (rule.frameworkRef ?? "").toLowerCase()
    );
    if (fw) {
      edges.push({
        id: createAifId("edge", `${rule.id}-${fw.id}`),
        from: rule.id,
        to: fw.id,
        relation: "requires",
        weight: 0.8,
      });
    }
  }

  for (const checklist of draft.checklists) {
    const relatedFw = draft.frameworks.find((f) => f.category === checklist.category);
    if (relatedFw) {
      edges.push({
        id: createAifId("edge", `${checklist.id}-${relatedFw.id}`),
        from: checklist.id,
        to: relatedFw.id,
        relation: "validates",
        weight: 0.75,
      });
    }
  }

  return { nodes, edges };
}

export function summarizeAifGraph(graph: AifKnowledgeGraph): string {
  const funnel = graph.nodes
    .filter((n) => n.id.startsWith("funnel-"))
    .map((n) => n.label)
    .join(" → ");

  const entityCount = graph.nodes.filter((n) => !n.id.startsWith("funnel-")).length;
  return `${funnel} | ${entityCount} entidades, ${graph.edges.length} relações`;
}
