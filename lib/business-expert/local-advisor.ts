/**
 * Local Business Advisor — city operations guidance.
 */

import { getLocalBusiness } from "@/lib/business-expert/local-catalog";
import { draftCompleteBusinessPlan } from "@/lib/business-expert/complete-planner";
import type {
  BusinessContext,
  LocalAdvisorIntake,
  LocalAdvisorResult,
} from "@/lib/business-expert/types";

export function runLocalBusinessAdvisor(
  intake: LocalAdvisorIntake,
  ctx?: BusinessContext | null
): LocalAdvisorResult {
  const missing: string[] = [];
  if (!intake.city?.trim()) missing.push("Em qual cidade?");
  if (!intake.capital || intake.capital === "unknown") {
    missing.push("Qual capital disponível? (bootstrap/low/medium/high)");
  }
  if (!intake.type) missing.push("Qual tipo? (academia, restaurante, loja, salão…)");
  if (!intake.goal?.trim()) missing.push("Qual o objetivo (renda, estilo de vida, escala…)?");
  if (!intake.time || intake.time === "unknown") {
    missing.push("Quanto tempo você dedica?");
  }

  if (missing.length) {
    return {
      missingQuestions: missing,
      complete: false,
      estimatedInvestment: "—",
      structure: [],
      operations: [],
      marketing: [],
      financial: [],
      plan: null,
      summary: "Complete as perguntas para gerar o plano local.",
    };
  }

  const def = getLocalBusiness(intake.type!);
  const capital = intake.capital!;
  const estimatedInvestment =
    capital === "bootstrap"
      ? "Muito baixo — prefira popup/servico enxuto antes de ponto fixo"
      : capital === "low"
        ? def?.capexHints ?? "Baixo/médio — valide demanda antes de CAPEX alto"
        : capital === "medium"
          ? def?.capexHints ?? "Médio — orçar ponto + 3 meses de custo fixo"
          : def?.capexHints ?? "Alto — exija plano de caixa e break-even";

  const structure = [
    `Cidade: ${intake.city}`,
    `Tipo: ${def?.name ?? intake.type}`,
    "Licenças/alvarás (consultar profissionais locais)",
    "Equipe mínima do dia 1",
    "Fornecedores críticos",
  ];
  const operations = def?.operations ?? ["Rotina diária", "Checklist de qualidade"];
  const marketing = def?.marketingLocal ?? ["Google Maps", "indicação", "WhatsApp"];
  const financial = [
    "Liste custos fixos mensais (aluguel, gente, utilities)",
    "Calcule margem por ticket médio",
    "Defina break-even em clientes/dia",
    "Separe caixa pessoal e do negócio",
    "Orientação tributária com contador (não automatizamos impostos)",
  ];

  const plan = draftCompleteBusinessPlan({
    intent: "open_business",
    title: `Abrir ${def?.name ?? "negócio local"} em ${intake.city}`,
    objective: intake.goal!,
    mode: "empresa-local",
    context: ctx ?? null,
    checklist: [
      "Validar demanda no raio",
      "Orçar CAPEX e 3 meses OPEX",
      "Mapear 5 concorrentes",
      "Definir oferta de abertura",
      "Checklist de licenças com profissionais",
    ],
    milestones: [
      { title: "Validação local", criteria: "Sinais de demanda reais" },
      { title: "Orçamento fechado", criteria: "CAPEX+OPEX listados" },
      { title: "Abertura controlada", criteria: "Soft open / popup" },
    ],
    kpis: [
      { name: "Clientes/dia", target: "break-even + 20%" },
      { name: "Ticket médio", target: "definido" },
      { name: "Margem bruta", target: "monitorada semanalmente" },
    ],
  });

  return {
    missingQuestions: [],
    complete: true,
    estimatedInvestment,
    structure,
    operations,
    marketing,
    financial,
    plan,
    summary: `Plano local para ${def?.name ?? intake.type} em ${intake.city}. Riscos típicos: ${(def?.risks ?? []).join("; ") || "operação e caixa"}.`,
  };
}
