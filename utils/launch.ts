import type { CreatorCopylab, CreatorLaunchPlan, CreatorResearch } from "@/types/database";
import {
  computeChecklistProgress,
  formatBRL,
  rankProductsForLaunch,
  type CreatorProductBundle,
} from "@/utils/creator";
import { parseJsonStringArray } from "@/utils/research";

export type LaunchPipelineStep =
  | "pesquisa"
  | "produto"
  | "copy"
  | "criativos"
  | "landing"
  | "anuncios"
  | "lancado";

export const LAUNCH_PIPELINE_STEPS: { id: LaunchPipelineStep; label: string }[] = [
  { id: "pesquisa", label: "Pesquisa" },
  { id: "produto", label: "Produto" },
  { id: "copy", label: "Copy" },
  { id: "criativos", label: "Criativos" },
  { id: "landing", label: "Landing Page" },
  { id: "anuncios", label: "Anúncios" },
  { id: "lancado", label: "Lançado" },
];

export type GeneratedLaunchPlan = {
  titulo: string;
  estagio_atual: string;
  score_ia: number;
  receita_estimada: number;
  data_prevista_lancamento: string;
  tarefas: string[];
  cronograma: { semana: number; foco: string; tarefas: string[] }[];
  prioridades: string[];
};

export type LaunchDashboardMetrics = {
  produtoAtual: string;
  estagio: string;
  scoreIa: number;
  receitaEstimada: number;
  dataPrevista: string;
  checklistPercent: number;
  planosAtivos: number;
};

export type LaunchCenterData = {
  bundle: CreatorProductBundle | null;
  pipelineStep: LaunchPipelineStep;
  pipelineProgress: Record<LaunchPipelineStep, boolean>;
  research: CreatorResearch | null;
  copy: CreatorCopylab | null;
  plan: CreatorLaunchPlan | null;
};

export const LAUNCH_AI_CONTEXT = `Você é a Aura Launch Center — orquestra Research, Creator e CopyLab em lançamentos globais.
Adapte plano, cronograma, tarefas e receita estimada ao país, idioma, moeda e cultura do mercado alvo.
Tom executivo, orientado a ação, no idioma do produto.`;

export const LAUNCH_IA_ACTIONS = [
  {
    id: "iniciar-lancamento",
    label: "Iniciar lançamento",
    prompt: "Inicie o lançamento do meu produto com tarefas e cronograma.",
  },
  {
    id: "proximo-passo",
    label: "Próximo passo",
    prompt: "Qual meu próximo passo para lançar?",
  },
  {
    id: "falta-lancar",
    label: "O que falta?",
    prompt: "O que falta para lançar?",
  },
] as const;

const LAUNCH_NEXT_STEP_PHRASES = [
  "qual meu proximo passo",
  "qual o proximo passo",
  "proximo passo",
  "meu proximo passo",
] as const;

const LAUNCH_MISSING_PHRASES = [
  "o que falta para lancar",
  "o que falta pra lancar",
  "falta para lancar",
  "falta pra lancar",
] as const;

const LAUNCH_MONETIZE_PHRASES = [
  "quanto falta para monetizar",
  "quanto falta pra monetizar",
  "falta para monetizar",
  "quando vou monetizar",
] as const;

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function matchesAny(normalized: string, phrases: readonly string[]): boolean {
  return phrases.some((p) => normalized.includes(normalize(p)));
}

export type LaunchCoachMode = "launch-next" | "launch-missing" | "launch-monetize";

export function detectLaunchCoachMode(message: string): LaunchCoachMode | null {
  const normalized = normalize(message);
  if (!normalized) return null;
  if (matchesAny(normalized, LAUNCH_MONETIZE_PHRASES)) return "launch-monetize";
  if (matchesAny(normalized, LAUNCH_MISSING_PHRASES)) return "launch-missing";
  if (matchesAny(normalized, LAUNCH_NEXT_STEP_PHRASES)) return "launch-next";
  return null;
}

export function resolvePipelineProgress(
  bundle: CreatorProductBundle,
  research: CreatorResearch | null,
  copy: CreatorCopylab | null
): Record<LaunchPipelineStep, boolean> {
  const status = bundle.product.status;
  const hasResearch = !!research;
  const hasCopy = !!copy || !!bundle.offer;

  return {
    pesquisa: hasResearch || !["ideia"].includes(status),
    produto: !!bundle.validation || ["validacao", "producao", "pagina_vendas", "criativos", "lancamento", "trafego", "escala"].includes(status),
    copy: hasCopy || ["pagina_vendas", "criativos", "lancamento", "trafego", "escala"].includes(status),
    criativos: ["criativos", "lancamento", "trafego", "escala"].includes(status),
    landing: !!bundle.offer || !!copy?.pagina_vendas || ["pagina_vendas", "criativos", "lancamento", "trafego", "escala"].includes(status),
    anuncios: ["trafego", "escala"].includes(status) || !!copy?.facebook_ad,
    lancado:
      status === "escala" ||
      bundle.launch?.status === "completed" ||
      bundle.launch?.status === "active",
  };
}

export function resolveCurrentPipelineStep(
  progress: Record<LaunchPipelineStep, boolean>
): LaunchPipelineStep {
  for (const step of LAUNCH_PIPELINE_STEPS) {
    if (!progress[step.id]) return step.id;
  }
  return "lancado";
}

export function buildLaunchCenterData(
  bundles: CreatorProductBundle[],
  researchRecords: CreatorResearch[],
  copyRecords: CreatorCopylab[],
  plans: CreatorLaunchPlan[]
): LaunchCenterData {
  const ranked = rankProductsForLaunch(bundles);
  const bundle = ranked[0] ?? null;

  if (!bundle) {
    return {
      bundle: null,
      pipelineStep: "pesquisa",
      pipelineProgress: {
        pesquisa: false,
        produto: false,
        copy: false,
        criativos: false,
        landing: false,
        anuncios: false,
        lancado: false,
      },
      research: null,
      copy: null,
      plan: plans[0] ?? null,
    };
  }

  const research =
    researchRecords.find((r) => r.product_id === bundle.product.id) ?? null;
  const copy = copyRecords.find((c) => c.product_id === bundle.product.id) ?? null;
  const plan =
    plans.find((p) => p.product_id === bundle.product.id) ?? plans[0] ?? null;
  const pipelineProgress = resolvePipelineProgress(bundle, research, copy);
  const pipelineStep = resolveCurrentPipelineStep(pipelineProgress);

  return { bundle, pipelineStep, pipelineProgress, research, copy, plan };
}

export function computeLaunchDashboard(
  center: LaunchCenterData,
  plans: CreatorLaunchPlan[]
): LaunchDashboardMetrics {
  const bundle = center.bundle;
  const progress = bundle
    ? computeChecklistProgress(bundle.checklist, bundle.product.status)
    : { percent: 0 };

  const receita =
    center.plan?.receita_estimada ??
    bundle?.launch?.potencial_estimado ??
    bundle?.product.receita_prevista ??
    0;

  return {
    produtoAtual: bundle?.product.nome ?? "—",
    estagio:
      LAUNCH_PIPELINE_STEPS.find((s) => s.id === center.pipelineStep)?.label ?? "—",
    scoreIa:
      center.plan?.score_ia ??
      bundle?.validation?.nota_final ??
      0,
    receitaEstimada: Number(receita),
    dataPrevista: center.plan?.data_prevista_lancamento ?? bundle?.product.prazo ?? "—",
    checklistPercent: progress.percent,
    planosAtivos: plans.length,
  };
}

export function buildLaunchAuraContext(
  center: LaunchCenterData,
  plans: CreatorLaunchPlan[]
): string {
  if (!center.bundle) return "Nenhum produto em lançamento.";

  const { bundle, pipelineStep, research, copy } = center;
  const stepLabel =
    LAUNCH_PIPELINE_STEPS.find((s) => s.id === pipelineStep)?.label ?? pipelineStep;

  return [
    `Produto: ${bundle.product.nome ?? "—"}`,
    `Estágio Launch: ${stepLabel}`,
    `Score IA: ${bundle.validation?.nota_final ?? "—"}/100`,
    `Receita estimada: ${formatBRL(center.plan?.receita_estimada ?? bundle.product.receita_prevista)}`,
    research ? `Research: ${research.nicho ?? "vinculado"}` : "Research: pendente",
    copy ? `CopyLab: ${copy.headline?.slice(0, 50) ?? "gerada"}` : "CopyLab: pendente",
    `Planos de lançamento: ${plans.length}`,
  ].join("\n");
}

export function buildLaunchCoachReply(params: {
  mode: LaunchCoachMode;
  displayName: string;
  center: LaunchCenterData;
  plans: CreatorLaunchPlan[];
}): string {
  const { mode, displayName, center, plans } = params;
  const { bundle, pipelineStep, pipelineProgress, research, copy } = center;

  if (!bundle) {
    return `Olá, ${displayName}!

Nenhum produto pronto para lançamento.

**Fluxo recomendado:**
1. **Market Research** → /dashboard/creator/research
2. **Creator** → criar e validar produto
3. **CopyLab** → gerar comunicação
4. **Launch Center** → /dashboard/creator/launch

Comece validando uma ideia no Research.`;
  }

  const stepLabel =
    LAUNCH_PIPELINE_STEPS.find((s) => s.id === pipelineStep)?.label ?? pipelineStep;
  const pending = LAUNCH_PIPELINE_STEPS.filter((s) => !pipelineProgress[s.id]).map(
    (s) => s.label
  );
  const checklist = computeChecklistProgress(bundle.checklist, bundle.product.status);
  const receita =
    plans[0]?.receita_estimada ??
    bundle.launch?.potencial_estimado ??
    bundle.product.receita_prevista;

  if (mode === "launch-next") {
    const nextActions: Record<LaunchPipelineStep, string> = {
      pesquisa: "Abra **Market Research** e valide o nicho antes de criar o produto.",
      produto: "Valide o produto no **Creator** com scores de demanda e viabilidade.",
      copy: "Gere a copy completa no **CopyLab** — headline, VSL, anúncios.",
      criativos: "Crie criativos (Reels, carrossel, stories) no CopyLab ou Social Media.",
      landing: "Monte a landing page com a copy gerada no CopyLab.",
      anuncios: "Configure campanhas (Facebook/Google) com os anúncios do CopyLab.",
      lancado: "Produto lançado! Foque em tráfego e escala no Creator.",
    };

    return `Olá, ${displayName}!

**Produto:** ${bundle.product.nome ?? "—"}
**Estágio atual:** ${stepLabel}
**Score IA:** ${bundle.validation?.nota_final ?? "—"}/100

**Próximo passo:**
${nextActions[pipelineStep]}

**Checklist:** ${checklist.done}/${checklist.total} (${checklist.percent}%)

Abra o **Launch Center** → /dashboard/creator/launch`;
  }

  if (mode === "launch-missing") {
    const items: string[] = [];
    if (!pipelineProgress.pesquisa)
      items.push("• Pesquisa de mercado (Research)");
    if (!pipelineProgress.produto)
      items.push("• Validação do produto (Creator)");
    if (!pipelineProgress.copy)
      items.push("• Copy completa (CopyLab)");
    if (!pipelineProgress.criativos)
      items.push("• Criativos para redes e ads");
    if (!pipelineProgress.landing)
      items.push("• Landing page montada");
    if (!pipelineProgress.anuncios)
      items.push("• Campanhas de anúncios configuradas");
    if (!pipelineProgress.lancado)
      items.push("• Lançamento ativo");

    if (checklist.percent < 100) {
      items.push(
        `• Checklist do estágio ${bundle.product.status}: ${checklist.done}/${checklist.total}`
      );
    }

    return `Olá, ${displayName}!

**Produto:** ${bundle.product.nome ?? "—"}
**Estágio:** ${stepLabel}

**O que falta para lançar:**
${items.length > 0 ? items.join("\n") : "✅ Tudo pronto — clique **Iniciar Lançamento** no Launch Center!"}

${research ? "" : "⚠️ Sem pesquisa de mercado vinculada."}
${copy ? "" : "⚠️ Sem copy gerada no CopyLab."}

**Launch Center** → /dashboard/creator/launch`;
  }

  const dataPrevista = plans[0]?.data_prevista_lancamento ?? bundle.product.prazo ?? "a definir";
  const gap =
    receita != null && bundle.product.objetivo_financeiro
      ? Math.max(0, bundle.product.objetivo_financeiro - Number(receita))
      : null;

  return `Olá, ${displayName}!

**Produto:** ${bundle.product.nome ?? "—"}
**Receita estimada:** ${formatBRL(receita)}
${bundle.product.objetivo_financeiro ? `**Meta financeira:** ${formatBRL(bundle.product.objetivo_financeiro)}` : ""}
${gap != null && gap > 0 ? `**Gap para meta:** ${formatBRL(gap)}` : ""}
**Data prevista:** ${dataPrevista}
**Estágio:** ${stepLabel} (${checklist.percent}% checklist)

${pipelineStep === "lancado" ? "✅ Produto em fase de lançamento/escala — foque em tráfego!" : `Faltam ${pending.length} etapa(s): ${pending.join(" → ")}`}

Use **Iniciar Lançamento** no Launch Center para gerar cronograma com IA.`;
}

export { formatBRL, parseJsonStringArray };
