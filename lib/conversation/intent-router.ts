/**
 * Rule-based intent router. LLM suggestions must be re-validated here.
 */

import {
  isCommandLikeQuery,
  parseCommandIntent,
  parseNaturalSearchQuery,
} from "@/lib/orchestrator";
import type {
  ConversationIntent,
  ConversationIntentKind,
  ConversationTargetType,
} from "@/lib/conversation/types";
import { ROUTE_REGISTRY } from "@/lib/conversation/types";

type Rule = {
  kind: ConversationIntentKind;
  patterns: RegExp[];
  targetType?: ConversationTargetType;
  actionability?: ConversationIntent["actionability"];
  requiresConfirmation?: boolean;
  href?: string | null;
  handlers: string[];
};

const RULES: Rule[] = [
  {
    kind: "CONFIRM_ACTION",
    patterns: [/^\s*confirm(ar|e)?\b/i, /\bconfirmar\s+a[cç][aã]o\b/i],
    actionability: "confirm",
    requiresConfirmation: true,
    handlers: ["confirm"],
  },
  {
    kind: "CANCEL_ACTION",
    patterns: [/^\s*cancel(ar|e)?\b/i, /\bcancelar\s+a[cç][aã]o\b/i],
    actionability: "confirm",
    handlers: ["cancel"],
  },
  {
    kind: "UPDATE_CONTEXT",
    patterns: [
      /\btrocar\s+contexto\b/i,
      /\bmudar\s+(?:para\s+)?(?:projeto|workspace|miss[aã]o|plano)\b/i,
      /\batualizar\s+contexto\b/i,
    ],
    actionability: "none",
    handlers: ["update_context"],
  },
  {
    kind: "EXPLAIN",
    patterns: [
      /\bpor\s+que\s+(?:voc[eê]|est[aá])/i,
      /\bquais\s+dados\s+usou\b/i,
      /\bqual\s+[eé]\s+a\s+confian/i,
      /\bo\s+que\s+est[aá]\s+faltando\b/i,
      /\bexplic(a|ar)\b/i,
      /\bwhy\s+(?:are\s+you|did\s+you)\b/i,
    ],
    actionability: "explain",
    handlers: ["explain"],
  },
  {
    kind: "PROPOSE_PLAN",
    patterns: [
      /\bcri(e|ar)\s+(?:um\s+)?(?:rascunho\s+de\s+)?plano\b/i,
      /\btransforme?\s+(?:esta\s+)?recomenda/i,
      /\bpropose?\s+(?:a\s+)?plan\b/i,
    ],
    targetType: "recommendation",
    actionability: "propose",
    requiresConfirmation: true,
    handlers: ["propose_plan"],
  },
  {
    kind: "PROPOSE_AUTOMATION",
    patterns: [
      /\bprepar(e|ar)\s+(?:uma\s+)?automa/i,
      /\bpropose?\s+(?:an\s+)?automation\b/i,
      /\bautoma[cç][aã]o\s+para\s+(?:esta\s+)?etapa\b/i,
    ],
    targetType: "plan",
    actionability: "propose",
    requiresConfirmation: true,
    handlers: ["propose_automation"],
  },
  {
    kind: "START_AGENT_SESSION",
    patterns: [
      /\buse\s+o?\s*plan\s+assistant\b/i,
      /\binici(e|ar)\s+(?:um\s+)?agente\b/i,
      /\babra?\s+(?:o\s+)?agent\b/i,
      /\bsess[aã]o\s+de\s+agente\b/i,
    ],
    targetType: "agent",
    actionability: "propose",
    requiresConfirmation: true,
    handlers: ["start_agent"],
  },
  {
    kind: "CREATE_DRAFT",
    patterns: [
      /\bcri(e|ar)\s+(?:um\s+)?rascunho\b/i,
      /\brascunho\s+de\s+(?:mem[oó]ria|nota|ideia|conte[uú]do|evento)\b/i,
      /\bdraft\b/i,
    ],
    actionability: "draft",
    requiresConfirmation: true,
    handlers: ["create_draft"],
  },
  {
    kind: "SUMMARIZE",
    patterns: [
      /\bresum(a|e|ir)\b/i,
      /\bsummary\b/i,
      /\bo\s+que\s+merece\s+minha\s+aten/i,
      /\borganize?\s+meu\s+dia\b/i,
    ],
    actionability: "none",
    handlers: ["summarize"],
  },
  {
    kind: "REVIEW",
    patterns: [
      /\brevis(e|ar)\b/i,
      /\bquais\s+decis[oõ]es?\s+.*revis/i,
      /\bprecisam\s+de\s+revis/i,
    ],
    targetType: "decision",
    actionability: "none",
    handlers: ["review"],
  },
  {
    kind: "COMPARE",
    patterns: [/\bcompar(e|ar)\b/i, /\bversus\b|\bvs\.?\b/i],
    actionability: "none",
    handlers: ["compare"],
  },
  {
    kind: "ASK_STATUS",
    patterns: [
      /\bquero\s+abrir\s+(um\s+)?neg[oó]cio\b/i,
      /\bquero\s+empreender\b/i,
      /\bquero\s+ganhar\s+dinheiro\b/i,
      /\bquero\s+validar\s+(uma\s+)?ideia\b/i,
      /\bquero\s+criar\s+(uma\s+)?empresa\b/i,
      /\bquero\s+criar\s+(um\s+)?curso\b/i,
      /\bquero\s+vender\s+online\b/i,
      /\bquero\s+viver\s+de\s+internet\b/i,
      /\bquero\s+vender\s+como\s+afiliad/i,
      /\bquero\s+criar\s+(um\s+)?produto\b/i,
      /\bqual\s+melhor\s+plataforma\b/i,
      /\bcomo\s+criar\s+(um\s+)?produto\b/i,
      /\bcomo\s+vender\s+como\s+afiliad/i,
      /\bcomo\s+montar\s+(uma\s+)?oferta\b/i,
      /\bcomo\s+encontrar\s+clientes\b/i,
      /\bcomo\s+validar\s+(uma\s+)?ideia\b/i,
      /\bkiwify\s+(ou|vs\.?|versus)\s+hotmart\b/i,
      /\bhotmart\s+(ou|vs\.?|versus)\s+kiwify\b/i,
      /\be\s+se\s+eu\s+(vender|criar|abrir)\b/i,
    ],
    targetType: "business",
    actionability: "none",
    href: ROUTE_REGISTRY["business-expert"],
    handlers: ["business_expert"],
  },
  {
    kind: "ASK_STATUS",
    patterns: [
      /\bo\s+que\s+(?:meu\s+s[oó]cio|mudou|atualizou)\b/i,
      /\bquais\s+riscos?\b/i,
      /\bstatus\b/i,
      /\bo\s+que\s+est[aá]\s+acontecendo\b/i,
      /\batividade\s+do\s+workspace\b/i,
      /\bo\s+que\s+(?:voc[eê]\s+)?aprendeu\b/i,
      /\bpor\s+que\s+(?:voc[eê]\s+)?quer\s+alterar\b/i,
      /\bn[aã]o\s+aprenda\s+isso\b/i,
      /\brevert[ae]\s+(?:esta\s+)?mudan/i,
      /\bquais\s+skills\s+(est[aã]o\s+)?instaladas/i,
      /\bquais\s+capacidades\s+(est[aã]o\s+)?desativadas/i,
      /\bmostre\s+as\s+permiss[oõ]es\s+(desta|da)\s+skill/i,
      /\bativate?\s+a\s+skill\s+de\s+projetos/i,
      /\bative\s+a\s+skill\s+de\s+projetos/i,
      /\bconfigure\s+meu\s+workspace\b/i,
    ],
    actionability: "none",
    handlers: ["ask_status", "learning", "platform"],
  },
  {
    kind: "SEARCH",
    patterns: [
      /\bencontr(e|ar)\b/i,
      /\bbusc(a|ar|que)\b/i,
      /\bprocur(e|ar)\b/i,
      /\bdocumentos?\s+(?:sobre|relacionad)/i,
      /\bmem[oó]rias?\s+criadas?\b/i,
    ],
    actionability: "search",
    handlers: ["search"],
  },
  {
    kind: "NAVIGATE",
    patterns: [
      /\babr(?:a|e|ir)\b/i,
      /\bmostr(?:e|ar)\b/i,
      /\bv[aá]\s+para\b/i,
      /\bopen\b/i,
      /\bgo\s+to\b/i,
    ],
    actionability: "navigate",
    handlers: ["navigate"],
  },
];

function baseIntent(
  kind: ConversationIntentKind,
  query: string,
  partial: Partial<ConversationIntent> = {}
): ConversationIntent {
  return {
    id: `intent_${kind}_${Date.now()}`,
    kind,
    confidence: partial.confidence ?? 0.5,
    entities: partial.entities ?? [],
    targetType: partial.targetType ?? "none",
    targetId: partial.targetId ?? null,
    workspaceId: partial.workspaceId ?? null,
    projectId: partial.projectId ?? null,
    missionId: partial.missionId ?? null,
    planId: partial.planId ?? null,
    actionability: partial.actionability ?? "none",
    requiresConfirmation: partial.requiresConfirmation ?? false,
    allowedHandlers: partial.allowedHandlers ?? ["unknown"],
    ambiguity: partial.ambiguity ?? [],
    missingInformation: partial.missingInformation ?? [],
    query,
    navigationHref: partial.navigationHref ?? null,
  };
}

function inferTarget(query: string): {
  targetType: ConversationTargetType;
  href: string | null;
} {
  const q = query.toLowerCase();
  if (/projeto/.test(q)) return { targetType: "project", href: ROUTE_REGISTRY.projects };
  if (/miss[aã]o/.test(q)) return { targetType: "mission", href: ROUTE_REGISTRY.missions };
  if (/plano/.test(q)) return { targetType: "plan", href: ROUTE_REGISTRY.plans };
  if (/automa/.test(q)) return { targetType: "automation", href: ROUTE_REGISTRY.automations };
  if (/agente/.test(q)) return { targetType: "agent", href: ROUTE_REGISTRY.agents };
  if (/prioridade/.test(q)) return { targetType: "priority", href: ROUTE_REGISTRY.priorities };
  if (/recomenda/.test(q))
    return { targetType: "recommendation", href: ROUTE_REGISTRY.recommendations };
  if (/decis/.test(q)) return { targetType: "decision", href: ROUTE_REGISTRY.decisions };
  if (/cen[aá]rio/.test(q)) return { targetType: "scenario", href: ROUTE_REGISTRY.scenarios };
  if (/discovery|descobert/.test(q))
    return { targetType: "discovery", href: ROUTE_REGISTRY.discovery };
  if (/documento|knowledge/.test(q))
    return { targetType: "document", href: ROUTE_REGISTRY.knowledge };
  if (/mem[oó]ria/.test(q)) return { targetType: "memory", href: ROUTE_REGISTRY.memory };
  if (/workspace|s[oó]cio/.test(q))
    return { targetType: "workspace", href: ROUTE_REGISTRY.home };
  if (/\bdia\b|aten[cç][aã]o/.test(q)) return { targetType: "day", href: ROUTE_REGISTRY.home };
  if (/\bsemana\b/.test(q)) return { targetType: "week", href: ROUTE_REGISTRY.home };
  if (/business\s+expert|especialista\s+em\s+neg[oó]cios/.test(q))
    return {
      targetType: "business",
      href: ROUTE_REGISTRY["business-expert"],
    };
  if (/empresa|business|neg[oó]cio/.test(q))
    return { targetType: "business", href: ROUTE_REGISTRY.business };
  return { targetType: "none", href: null };
}

/**
 * Classify intent with deterministic rules first.
 * Optional LLM kind is accepted only if it matches an allowed kind and passes rules.
 */
export function routeConversationIntent(
  message: string,
  opts?: {
    llmKind?: ConversationIntentKind | null;
    focus?: {
      workspaceId?: string | null;
      projectId?: string | null;
      missionId?: string | null;
      planId?: string | null;
    };
  }
): ConversationIntent {
  const query = message.trim();
  if (!query) {
    return baseIntent("UNKNOWN", query, {
      confidence: 0,
      missingInformation: ["empty_message"],
      ambiguity: ["Mensagem vazia"],
    });
  }

  for (const rule of RULES) {
    if (rule.patterns.some((p) => p.test(query))) {
      const target = inferTarget(query);
      let href = rule.href ?? target.href;
      let navigationHref = href;

      if (rule.kind === "NAVIGATE") {
        const cmd = parseCommandIntent(query);
        if (cmd.kind !== "unknown" && cmd.kind !== "search_nl") {
          navigationHref = cmd.href;
          href = cmd.href;
        } else if (!navigationHref) {
          navigationHref = ROUTE_REGISTRY.home;
        }
      }

      if (rule.kind === "SEARCH" || isCommandLikeQuery(query) === false) {
        const nl = parseNaturalSearchQuery(query);
        if (rule.kind === "SEARCH" && nl.entityHints.length) {
          // keep search
        }
      }

      const intent = baseIntent(rule.kind, query, {
        confidence: 0.85,
        targetType: rule.targetType ?? target.targetType,
        actionability: rule.actionability ?? "none",
        requiresConfirmation: rule.requiresConfirmation ?? false,
        allowedHandlers: rule.handlers,
        navigationHref: rule.kind === "NAVIGATE" ? navigationHref : null,
        workspaceId: opts?.focus?.workspaceId ?? null,
        projectId: opts?.focus?.projectId ?? null,
        missionId: opts?.focus?.missionId ?? null,
        planId: opts?.focus?.planId ?? null,
        entities: extractEntities(query),
      });

      // Validate optional LLM suggestion — never trust blindly
      if (opts?.llmKind && opts.llmKind !== rule.kind) {
        intent.ambiguity.push(
          `llm_suggested_${opts.llmKind}_overridden_by_rules`
        );
        intent.confidence = Math.min(intent.confidence, 0.8);
      }
      return intent;
    }
  }

  // Palette / search fallbacks
  const cmd = parseCommandIntent(query);
  if (cmd.kind !== "unknown" && cmd.kind !== "search_nl") {
    return baseIntent("NAVIGATE", query, {
      confidence: 0.75,
      actionability: "navigate",
      allowedHandlers: ["navigate"],
      navigationHref: cmd.href,
      targetType: inferTarget(query).targetType,
      entities: extractEntities(query),
    });
  }

  const nl = parseNaturalSearchQuery(query);
  if (nl.entityHints.length >= 1) {
    return baseIntent("SEARCH", query, {
      confidence: 0.7,
      actionability: "search",
      allowedHandlers: ["search"],
      targetType: inferTarget(query).targetType,
      entities: [...nl.entityHints, ...nl.topicHints],
    });
  }

  // Soft search only when explicit search verbs present
  if (
    /^\s*(?:buscar|busque|procure|procurar|pesquise|pesquisar|encontre|encontrar|find|search)\b/i.test(
      query
    ) &&
    nl.topicHints.length >= 1
  ) {
    return baseIntent("SEARCH", query, {
      confidence: 0.65,
      actionability: "search",
      allowedHandlers: ["search"],
      targetType: inferTarget(query).targetType,
      entities: nl.topicHints,
    });
  }

  if (opts?.llmKind && opts.llmKind !== "UNKNOWN") {
    // Only accept LLM kind if it's in the known set — still low confidence
    return baseIntent(opts.llmKind, query, {
      confidence: 0.45,
      actionability: "none",
      allowedHandlers: ["llm_soft"],
      ambiguity: ["low_confidence_llm"],
      missingInformation: ["needs_clarification"],
      entities: extractEntities(query),
    });
  }

  return baseIntent("UNKNOWN", query, {
    confidence: 0.2,
    ambiguity: ["Não entendi o pedido com segurança"],
    missingInformation: ["clarification"],
    allowedHandlers: ["unknown"],
    entities: extractEntities(query),
  });
}

function extractEntities(query: string): string[] {
  return query
    .split(/\s+/)
    .map((t) => t.replace(/[^\p{L}\p{N}_-]/gu, ""))
    .filter((t) => t.length > 2)
    .slice(0, 12);
}

export function intentsAreCompatible(
  a: ConversationIntentKind,
  b: ConversationIntentKind
): boolean {
  if (a === b) return true;
  if (a === "UNKNOWN" || b === "UNKNOWN") return false;
  const soft = new Set(["ASK_STATUS", "SUMMARIZE", "REVIEW", "EXPLAIN"]);
  return soft.has(a) && soft.has(b);
}
