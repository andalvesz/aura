import type { XpHistory, XpAcao } from "@/types/database";
import { todayIsoDate } from "@/utils/health";

export type { XpAcao };

export const XP_REWARDS: Record<XpAcao, number> = {
  registrar_despesa: 5,
  registrar_receita: 5,
  criar_evento: 10,
  concluir_evento: 10,
  completar_habito: 10,
  completar_treino: 15,
  follow_up_realizado: 20,
  lead_convertido: 30,
  evento_fechado_alvesz: 50,
  criar_viagem: 15,
  completar_checklist_viagem: 10,
  concluir_aula_ingles: 10,
  exercicio_ingles_concluido: 5,
  modulo_ingles_completo: 20,
  missao_prospectar: 25,
  missao_postar: 20,
  missao_followup: 20,
  missao_oferta: 30,
  missao_estudar: 15,
  missao_analisar: 15,
  criar_conteudo: 5,
  gerar_roteiro: 10,
  publicar_conteudo: 15,
  missao_money_concluir: 20,
  money_primeira_venda: 50,
  money_primeiro_produto: 40,
  money_primeiro_lancamento: 60,
  money_meta_atingida: 200,
};

export const XP_ACAO_LABELS: Record<XpAcao, string> = {
  registrar_despesa: "Despesa registrada",
  registrar_receita: "Receita registrada",
  criar_evento: "Evento criado",
  concluir_evento: "Evento concluído",
  completar_habito: "Hábito completado",
  completar_treino: "Treino completado",
  follow_up_realizado: "Follow-up realizado",
  lead_convertido: "Lead convertido",
  evento_fechado_alvesz: "Evento Alvesz fechado",
  criar_viagem: "Viagem criada",
  completar_checklist_viagem: "Item do checklist concluído",
  concluir_aula_ingles: "Aula de inglês concluída",
  exercicio_ingles_concluido: "Exercício de inglês concluído",
  modulo_ingles_completo: "Módulo de inglês completo",
  missao_prospectar: "Missão: prospectar clientes",
  missao_postar: "Missão: postar conteúdo",
  missao_followup: "Missão: follow-up",
  missao_oferta: "Missão: criar oferta",
  missao_estudar: "Missão: estudar vendas",
  missao_analisar: "Missão: analisar perfil",
  criar_conteudo: "Conteúdo criado",
  gerar_roteiro: "Roteiro gerado",
  publicar_conteudo: "Conteúdo publicado",
  missao_money_concluir: "Missão Money concluída",
  money_primeira_venda: "Primeira venda",
  money_primeiro_produto: "Primeiro produto",
  money_primeiro_lancamento: "Primeiro lançamento",
  money_meta_atingida: "Meta financeira atingida",
};

const LEVEL_THRESHOLDS = [0, 100, 250, 450, 700] as const;

export function getLevelThreshold(level: number): number {
  if (level <= 1) return 0;
  if (level - 1 < LEVEL_THRESHOLDS.length) {
    return LEVEL_THRESHOLDS[level - 1];
  }

  let xp = LEVEL_THRESHOLDS[LEVEL_THRESHOLDS.length - 1];
  let increment = 250;
  for (let current = LEVEL_THRESHOLDS.length + 1; current <= level; current++) {
    increment += 50;
    xp += increment;
  }
  return xp;
}

export function calculateLevel(xpTotal: number): number {
  let level = 1;
  while (getLevelThreshold(level + 1) <= xpTotal) {
    level += 1;
  }
  return level;
}

export type XpProgress = {
  level: number;
  xpTotal: number;
  currentThreshold: number;
  nextThreshold: number;
  xpInLevel: number;
  xpNeeded: number;
  pct: number;
};

export function getXpProgress(xpTotal: number): XpProgress {
  const level = calculateLevel(xpTotal);
  const currentThreshold = getLevelThreshold(level);
  const nextThreshold = getLevelThreshold(level + 1);
  const xpInLevel = xpTotal - currentThreshold;
  const xpNeeded = nextThreshold - currentThreshold;
  const pct =
    xpNeeded > 0 ? Math.min(100, Math.round((xpInLevel / xpNeeded) * 100)) : 100;

  return {
    level,
    xpTotal,
    currentThreshold,
    nextThreshold,
    xpInLevel,
    xpNeeded,
    pct,
  };
}

export function getStreakDisplay(streak: number): string {
  if (streak >= 30) return "🏆";
  if (streak >= 7) return "🔥🔥🔥";
  if (streak >= 3) return "🔥🔥";
  if (streak >= 1) return "🔥";
  return "";
}

export const DAILY_MISSIONS = [
  {
    id: "follow_up",
    label: "Fazer follow-up",
    actions: ["follow_up_realizado"] as XpAcao[],
  },
  {
    id: "financas",
    label: "Registrar finanças",
    actions: ["registrar_despesa", "registrar_receita"] as XpAcao[],
  },
  {
    id: "habito",
    label: "Completar hábito",
    actions: ["completar_habito"] as XpAcao[],
  },
  {
    id: "calendario",
    label: "Atualizar calendário",
    actions: ["criar_evento", "concluir_evento"] as XpAcao[],
  },
] as const;

export type DailyMissionId = (typeof DAILY_MISSIONS)[number]["id"];

export function isXpAcao(value: string): value is XpAcao {
  return value in XP_REWARDS;
}

export function toIsoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function historyEntryDate(entry: Pick<XpHistory, "created_at">): string {
  return entry.created_at.slice(0, 10);
}

export function getTodayActions(history: XpHistory[]): Set<XpAcao> {
  const today = todayIsoDate();
  const actions = new Set<XpAcao>();
  for (const entry of history) {
    if (historyEntryDate(entry) === today && isXpAcao(entry.acao)) {
      actions.add(entry.acao);
    }
  }
  return actions;
}

export function buildDailyMissionStatus(history: XpHistory[]) {
  const todayActions = getTodayActions(history);
  return DAILY_MISSIONS.map((mission) => ({
    ...mission,
    done: mission.actions.some((action) => todayActions.has(action)),
  }));
}

export function formatXpRemaining(xpTotal: number): number {
  const { nextThreshold } = getXpProgress(xpTotal);
  return Math.max(0, nextThreshold - xpTotal);
}

export function formatAchievementLabel(entry: Pick<XpHistory, "acao">): string {
  if (isXpAcao(entry.acao)) {
    return XP_ACAO_LABELS[entry.acao];
  }
  return entry.acao;
}
