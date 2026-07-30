/**
 * Mission templates — seed structure by MissionType.
 * No external APIs. Deterministic planning input.
 */

import type { MissionTemplate, MissionType } from "@/lib/missions/mission-types";

const travel: MissionTemplate = {
  id: "tpl-travel",
  type: "TRAVEL",
  title: "Viajar",
  description: "Planejar e realizar uma viagem com orçamento, documentos e roteiro.",
  estimatedDays: 90,
  modules: ["viagens", "financeiro", "calendario", "objetivos", "planner"],
  resources: [
    { kind: "money", title: "Orçamento de viagem", amount: null, unit: "BRL", notes: "Definir meta" },
    { kind: "document", title: "Documentos", amount: null, unit: null, notes: "Passaporte/visto" },
    { kind: "time", title: "Planejamento", amount: 20, unit: "h", notes: "Roteiro e reservas" },
  ],
  phases: [
    {
      title: "Planejamento",
      description: "Definir destino, datas e orçamento",
      estimatedDays: 21,
      moduleIds: ["viagens", "financeiro", "objetivos"],
      milestones: ["Destino escolhido", "Orçamento definido"],
      tasks: [
        { title: "Escolher destino", description: "Definir destino e janela de datas", moduleId: "viagens", estimatedHours: 3 },
        { title: "Definir meta financeira", description: "Criar meta de economia para a viagem", moduleId: "financeiro", estimatedHours: 2, riskLevel: "MEDIUM" },
        { title: "Bloquear datas no calendário", description: "Reservar período na agenda", moduleId: "calendario", estimatedHours: 1 },
      ],
    },
    {
      title: "Economia",
      description: "Acumular recursos e acompanhar progresso",
      estimatedDays: 45,
      moduleIds: ["financeiro", "objetivos", "habitos"],
      milestones: ["50% do orçamento", "100% do orçamento"],
      tasks: [
        { title: "Economizar dinheiro", description: "Atingir meta financeira da viagem", moduleId: "financeiro", estimatedHours: 8, riskLevel: "HIGH" },
        { title: "Revisar gastos semanais", description: "Ajustar orçamento pessoal", moduleId: "financeiro", estimatedHours: 2 },
      ],
    },
    {
      title: "Reservas",
      description: "Passagens, hospedagem e documentação",
      estimatedDays: 14,
      moduleIds: ["viagens", "financeiro", "calendario"],
      milestones: ["Passagem comprada", "Hospedagem confirmada"],
      tasks: [
        { title: "Comprar passagem", description: "Reservar voo/transporte após economia", moduleId: "viagens", estimatedHours: 2, riskLevel: "HIGH" },
        { title: "Reservar hospedagem", description: "Confirmar hotel/Airbnb", moduleId: "viagens", estimatedHours: 2, riskLevel: "MEDIUM" },
        { title: "Checklist de documentos", description: "Validar passaporte, visto e seguros", moduleId: "viagens", estimatedHours: 3 },
      ],
    },
    {
      title: "Execução",
      description: "Roteiro e experiência",
      estimatedDays: 10,
      moduleIds: ["viagens", "calendario"],
      milestones: ["Roteiro pronto", "Viagem concluída"],
      tasks: [
        { title: "Montar roteiro diário", description: "Atividades por dia", moduleId: "viagens", estimatedHours: 4 },
        { title: "Registrar memórias", description: "Notas e fotos pós-viagem", moduleId: "sistema", estimatedHours: 2 },
      ],
    },
  ],
  defaultRisks: [
    { title: "Orçamento insuficiente", description: "Economia pode atrasar compras", level: "HIGH", mitigation: "Ajustar meta ou adiar compra" },
    { title: "Documentação atrasada", description: "Passaporte/visto pode bloquear", level: "MEDIUM", mitigation: "Checklist antecipado" },
  ],
};

const business: MissionTemplate = {
  id: "tpl-business",
  type: "BUSINESS",
  title: "Abrir / crescer negócio",
  description: "Validar ideia, hipóteses e experimentos — nunca criar empresa automaticamente.",
  estimatedDays: 120,
  modules: ["business_lab", "financeiro", "objetivos", "planner", "expert_brain", "automation"],
  resources: [
    { kind: "time", title: "Pesquisa", amount: 40, unit: "h", notes: "Descoberta e validação" },
    { kind: "skill", title: "Conhecimento de mercado", amount: null, unit: null, notes: "Expert Brain / pesquisa" },
    { kind: "money", title: "Capital inicial (opcional)", amount: null, unit: "BRL", notes: "Somente após validação" },
  ],
  phases: [
    {
      title: "Descoberta",
      description: "Problema, audiência e oportunidades",
      estimatedDays: 21,
      moduleIds: ["business_lab", "expert_brain"],
      milestones: ["Problema definido", "Audiência descrita"],
      tasks: [
        { title: "Descrever problema", description: "Qual dor você resolve?", moduleId: "business_lab", estimatedHours: 4 },
        { title: "Mapear audiência", description: "Quem sente a dor?", moduleId: "business_lab", estimatedHours: 4 },
        { title: "Listar oportunidades", description: "Rascunhos de oportunidade (não cria empresa)", moduleId: "business_lab", estimatedHours: 3 },
      ],
    },
    {
      title: "Hipóteses",
      description: "Formular e priorizar hipóteses",
      estimatedDays: 21,
      moduleIds: ["business_lab", "planner"],
      milestones: ["Hipótese principal", "Critérios de sucesso"],
      tasks: [
        { title: "Escrever hipóteses", description: "Afirmações testáveis", moduleId: "business_lab", estimatedHours: 5 },
        { title: "Definir métricas", description: "Como saber se validou", moduleId: "objetivos", estimatedHours: 3 },
      ],
    },
    {
      title: "Experimentos",
      description: "Testes baratos e rápidos",
      estimatedDays: 45,
      moduleIds: ["business_lab", "financeiro", "automation"],
      milestones: ["Primeiro experimento", "Resultado documentado"],
      tasks: [
        { title: "Planejar experimento", description: "Método, custo e prazo", moduleId: "business_lab", estimatedHours: 4, riskLevel: "MEDIUM" },
        { title: "Executar experimento", description: "Coletar evidências", moduleId: "business_lab", estimatedHours: 12, riskLevel: "MEDIUM" },
        { title: "Analisar resultado", description: "Decidir pivot/persist/kill", moduleId: "business_lab", estimatedHours: 4 },
      ],
    },
    {
      title: "Estruturação",
      description: "Modelo e próximo passo (manual)",
      estimatedDays: 33,
      moduleIds: ["business_lab", "financeiro", "objetivos"],
      milestones: ["Modelo de receita rascunhado", "Plano de 30 dias"],
      tasks: [
        { title: "Rascunhar modelo de receita", description: "Preço e canais — sem abrir empresa", moduleId: "financeiro", estimatedHours: 6, riskLevel: "HIGH" },
        { title: "Plano de 30 dias", description: "Próximas ações manuais", moduleId: "planner", estimatedHours: 3 },
      ],
    },
  ],
  defaultRisks: [
    { title: "Validação fraca", description: "Decidir sem evidência", level: "HIGH", mitigation: "Exigir experimento antes de gastar" },
    { title: "Criar empresa cedo demais", description: "Custo sem demanda", level: "CRITICAL", mitigation: "Bloquear criação automática; só rascunhos" },
  ],
};

const learning: MissionTemplate = {
  id: "tpl-learning",
  type: "LEARNING",
  title: "Aprender inglês",
  description: "Rotina de estudo com hábitos, metas e sessões de idioma.",
  estimatedDays: 180,
  modules: ["idiomas", "habitos", "calendario", "objetivos", "planner"],
  resources: [
    { kind: "time", title: "Estudo diário", amount: 30, unit: "min/dia", notes: "Consistência > intensidade" },
    { kind: "tool", title: "Material", amount: null, unit: null, notes: "App, professor ou conteúdo" },
  ],
  phases: [
    {
      title: "Baseline",
      description: "Nível atual e meta",
      estimatedDays: 14,
      moduleIds: ["idiomas", "objetivos"],
      milestones: ["Nível definido", "Meta de fluência"],
      tasks: [
        { title: "Avaliar nível atual", description: "Self-assessment ou teste", moduleId: "idiomas", estimatedHours: 2 },
        { title: "Definir meta de aprendizado", description: "Objetivo mensurável", moduleId: "objetivos", estimatedHours: 1 },
      ],
    },
    {
      title: "Rotina",
      description: "Hábitos e agenda de estudo",
      estimatedDays: 90,
      moduleIds: ["idiomas", "habitos", "calendario"],
      milestones: ["Hábito criado", "Streak 14 dias"],
      tasks: [
        { title: "Criar hábito de estudo", description: "Sessão diária curta", moduleId: "habitos", estimatedHours: 1 },
        { title: "Agendar sessões", description: "Bloquear horário no calendário", moduleId: "calendario", estimatedHours: 1 },
        { title: "Completar sessões semanais", description: "Registrar no módulo de idiomas", moduleId: "idiomas", estimatedHours: 7 },
      ],
    },
    {
      title: "Prática",
      description: "Conversação e revisão",
      estimatedDays: 60,
      moduleIds: ["idiomas", "expert_brain"],
      milestones: ["Primeira conversação", "Revisão mensal"],
      tasks: [
        { title: "Praticar conversação", description: "Speaking com feedback", moduleId: "idiomas", estimatedHours: 8 },
        { title: "Revisar vocabulário", description: "Lista semanal", moduleId: "idiomas", estimatedHours: 4 },
      ],
    },
    {
      title: "Consolidação",
      description: "Avaliar progresso e ajustar",
      estimatedDays: 16,
      moduleIds: ["idiomas", "objetivos"],
      milestones: ["Meta atingida ou replanejada"],
      tasks: [
        { title: "Reavaliar nível", description: "Comparar com baseline", moduleId: "idiomas", estimatedHours: 2 },
        { title: "Ajustar plano", description: "Próximo ciclo", moduleId: "planner", estimatedHours: 2 },
      ],
    },
  ],
  defaultRisks: [
    { title: "Quebra de streak", description: "Inconsistência mata progresso", level: "MEDIUM", mitigation: "Sessões curtas e lembretes" },
  ],
};

const health: MissionTemplate = {
  id: "tpl-health",
  type: "HEALTH",
  title: "Melhorar saúde",
  description: "Treino, alimentação e hábitos com acompanhamento.",
  estimatedDays: 90,
  modules: ["saude", "habitos", "calendario", "objetivos", "planner"],
  resources: [
    { kind: "time", title: "Treinos", amount: 3, unit: "x/semana", notes: "Consistência" },
    { kind: "tool", title: "Plano alimentar", amount: null, unit: null, notes: "Dieta simples" },
  ],
  phases: [
    {
      title: "Diagnóstico",
      description: "Estado atual e metas",
      estimatedDays: 7,
      moduleIds: ["saude", "objetivos"],
      milestones: ["Meta de saúde definida"],
      tasks: [
        { title: "Definir meta de saúde", description: "Objetivo claro e mensurável", moduleId: "objetivos", estimatedHours: 1 },
        { title: "Registrar baseline", description: "Peso/hábitos/treino atual", moduleId: "saude", estimatedHours: 2 },
      ],
    },
    {
      title: "Rotina",
      description: "Treinos e hábitos",
      estimatedDays: 60,
      moduleIds: ["saude", "habitos", "calendario"],
      milestones: ["Plano de treino", "4 semanas consistentes"],
      tasks: [
        { title: "Criar plano de treino", description: "Rascunho semanal", moduleId: "saude", estimatedHours: 2 },
        { title: "Agendar treinos", description: "Calendário", moduleId: "calendario", estimatedHours: 1 },
        { title: "Criar hábitos de sono/água", description: "Hábitos de suporte", moduleId: "habitos", estimatedHours: 1 },
        { title: "Registrar refeições", description: "Acompanhar dieta", moduleId: "saude", estimatedHours: 4 },
      ],
    },
    {
      title: "Ajuste",
      description: "Revisar e evoluir",
      estimatedDays: 23,
      moduleIds: ["saude", "objetivos"],
      milestones: ["Revisão de progresso"],
      tasks: [
        { title: "Revisar progresso", description: "Comparar com meta", moduleId: "saude", estimatedHours: 2 },
        { title: "Ajustar plano", description: "Próximo ciclo", moduleId: "planner", estimatedHours: 2 },
      ],
    },
  ],
  defaultRisks: [
    { title: "Lesão / overtraining", description: "Excesso sem recuperação", level: "MEDIUM", mitigation: "Progressão gradual" },
    { title: "Abandono precoce", description: "Expectativa irrealista", level: "HIGH", mitigation: "Metas pequenas e hábitos" },
  ],
};

const financial: MissionTemplate = {
  id: "tpl-financial",
  type: "FINANCIAL",
  title: "Meta financeira",
  description: "Economizar, orçar e acompanhar progresso financeiro.",
  estimatedDays: 120,
  modules: ["financeiro", "objetivos", "habitos", "planner", "automation"],
  resources: [
    { kind: "money", title: "Meta de economia", amount: null, unit: "BRL", notes: "Definir valor" },
    { kind: "time", title: "Revisão semanal", amount: 1, unit: "h/semana", notes: "Acompanhamento" },
  ],
  phases: [
    {
      title: "Diagnóstico",
      description: "Saldo, gastos e meta",
      estimatedDays: 14,
      moduleIds: ["financeiro", "objetivos"],
      milestones: ["Saldo definido", "Meta criada"],
      tasks: [
        { title: "Definir saldo atual", description: "Baseline financeiro", moduleId: "financeiro", estimatedHours: 1 },
        { title: "Criar meta financeira", description: "Valor e prazo", moduleId: "objetivos", estimatedHours: 1, riskLevel: "MEDIUM" },
        { title: "Mapear gastos fixos", description: "Orçamento mensal", moduleId: "financeiro", estimatedHours: 3 },
      ],
    },
    {
      title: "Disciplina",
      description: "Hábitos de economia",
      estimatedDays: 75,
      moduleIds: ["financeiro", "habitos", "automation"],
      milestones: ["25%", "50%", "75% da meta"],
      tasks: [
        { title: "Criar hábito de revisão", description: "Check semanal de gastos", moduleId: "habitos", estimatedHours: 1 },
        { title: "Reduzir gasto crítico", description: "Cortar ou renegociar", moduleId: "financeiro", estimatedHours: 4, riskLevel: "HIGH" },
        { title: "Acompanhar progresso da meta", description: "Atualizar objetivo", moduleId: "objetivos", estimatedHours: 2 },
      ],
    },
    {
      title: "Consolidação",
      description: "Fechar meta e próximo passo",
      estimatedDays: 31,
      moduleIds: ["financeiro", "objetivos"],
      milestones: ["Meta atingida"],
      tasks: [
        { title: "Alocar recursos", description: "Destino do valor economizado", moduleId: "financeiro", estimatedHours: 2, riskLevel: "HIGH" },
        { title: "Definir próxima meta", description: "Continuidade", moduleId: "objetivos", estimatedHours: 1 },
      ],
    },
  ],
  defaultRisks: [
    { title: "Gasto impulsivo", description: "Quebra a meta", level: "HIGH", mitigation: "Alertas e revisão semanal" },
  ],
};

const personal: MissionTemplate = {
  id: "tpl-personal",
  type: "PERSONAL",
  title: "Objetivo pessoal",
  description: "Missão pessoal genérica com planejamento por fases.",
  estimatedDays: 60,
  modules: ["objetivos", "calendario", "habitos", "planner"],
  resources: [
    { kind: "time", title: "Tempo dedicado", amount: 5, unit: "h/semana", notes: "Reservar na agenda" },
  ],
  phases: [
    {
      title: "Clareza",
      description: "Definir o que sucesso significa",
      estimatedDays: 7,
      moduleIds: ["objetivos", "planner"],
      milestones: ["Objetivo escrito"],
      tasks: [
        { title: "Escrever objetivo", description: "Resultado concreto", moduleId: "objetivos", estimatedHours: 1 },
        { title: "Quebrar em etapas", description: "Fases e marcos", moduleId: "planner", estimatedHours: 2 },
      ],
    },
    {
      title: "Execução",
      description: "Tarefas e hábitos",
      estimatedDays: 40,
      moduleIds: ["calendario", "habitos", "objetivos"],
      milestones: ["Primeiro marco", "Meio do caminho"],
      tasks: [
        { title: "Agendar blocos de foco", description: "Calendário", moduleId: "calendario", estimatedHours: 1 },
        { title: "Criar hábito de suporte", description: "Rotina mínima", moduleId: "habitos", estimatedHours: 1 },
        { title: "Avançar tarefas principais", description: "Execução semanal", moduleId: "sistema", estimatedHours: 10 },
      ],
    },
    {
      title: "Revisão",
      description: "Avaliar e arquivar ou renovar",
      estimatedDays: 13,
      moduleIds: ["objetivos", "planner"],
      milestones: ["Missão concluída ou replanejada"],
      tasks: [
        { title: "Revisar resultado", description: "Comparar com objetivo", moduleId: "objetivos", estimatedHours: 2 },
      ],
    },
  ],
  defaultRisks: [
    { title: "Objetivo vago", description: "Difícil medir progresso", level: "MEDIUM", mitigation: "Critério de sucesso explícito" },
  ],
};

const custom: MissionTemplate = {
  id: "tpl-custom",
  type: "CUSTOM",
  title: "Missão customizada",
  description: "Estrutura mínima adaptável a qualquer objetivo.",
  estimatedDays: 45,
  modules: ["planner", "objetivos", "calendario", "automation"],
  resources: [
    { kind: "other", title: "Recursos a definir", amount: null, unit: null, notes: "Completar após clareza" },
  ],
  phases: [
    {
      title: "Planejamento",
      description: "Escopo e critérios",
      estimatedDays: 10,
      moduleIds: ["planner", "objetivos"],
      milestones: ["Escopo definido"],
      tasks: [
        { title: "Definir escopo", description: "O que entra e o que não entra", moduleId: "planner", estimatedHours: 2 },
        { title: "Listar dependências", description: "O que bloqueia o quê", moduleId: "planner", estimatedHours: 2 },
      ],
    },
    {
      title: "Execução",
      description: "Entregar marcos",
      estimatedDays: 28,
      moduleIds: ["calendario", "objetivos", "automation"],
      milestones: ["Marco 1", "Marco 2"],
      tasks: [
        { title: "Executar marco 1", description: "Primeira entrega", moduleId: "sistema", estimatedHours: 8 },
        { title: "Executar marco 2", description: "Segunda entrega", moduleId: "sistema", estimatedHours: 8 },
      ],
    },
    {
      title: "Fechamento",
      description: "Validar e documentar",
      estimatedDays: 7,
      moduleIds: ["objetivos", "planner"],
      milestones: ["Missão concluída"],
      tasks: [
        { title: "Validar critérios", description: "Checklist de conclusão", moduleId: "objetivos", estimatedHours: 2 },
      ],
    },
  ],
  defaultRisks: [
    { title: "Escopo creep", description: "Missão cresce sem controle", level: "MEDIUM", mitigation: "Revisar escopo semanalmente" },
  ],
};

/** Disney / trip variant — travel with entertainment focus */
const disney: MissionTemplate = {
  ...travel,
  id: "tpl-disney",
  title: "Disney",
  description: "Planejar viagem Disney: orçamento, datas, ingressos e roteiro.",
  estimatedDays: 180,
};

const BY_TYPE: Record<MissionType, MissionTemplate> = {
  PERSONAL: personal,
  BUSINESS: business,
  LEARNING: learning,
  HEALTH: health,
  FINANCIAL: financial,
  TRAVEL: travel,
  CUSTOM: custom,
};

const BY_ID: Record<string, MissionTemplate> = {
  [personal.id]: personal,
  [business.id]: business,
  [learning.id]: learning,
  [health.id]: health,
  [financial.id]: financial,
  [travel.id]: travel,
  [custom.id]: custom,
  [disney.id]: disney,
};

export function listMissionTemplates(): MissionTemplate[] {
  return Object.values(BY_ID);
}

export function getMissionTemplateByType(type: MissionType): MissionTemplate {
  return BY_TYPE[type] ?? custom;
}

export function getMissionTemplateById(id: string): MissionTemplate | null {
  return BY_ID[id] ?? null;
}

export function resolveMissionTemplate(
  type: MissionType,
  templateId?: string | null,
  titleHint?: string
): MissionTemplate {
  if (templateId) {
    const byId = getMissionTemplateById(templateId);
    if (byId) return byId;
  }
  if (titleHint && /disney/i.test(titleHint)) return disney;
  if (titleHint && /ingl[eê]s|english/i.test(titleHint)) return learning;
  if (titleHint && /im[oó]vel|casa|apartamento/i.test(titleHint)) {
    return {
      ...financial,
      id: "tpl-property",
      title: "Comprar imóvel",
      description: "Economizar, documentar e avançar rumo à compra de imóvel.",
    };
  }
  return getMissionTemplateByType(type);
}
