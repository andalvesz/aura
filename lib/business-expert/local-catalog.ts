/**
 * Local business catalog — neighborhood / city operations.
 */

import type {
  LocalBusinessDefinition,
  LocalBusinessId,
} from "@/lib/business-expert/types";

export const LOCAL_BUSINESSES: LocalBusinessDefinition[] = [
  {
    id: "academia",
    name: "Academia",
    summary: "Espaço de treino com mensalidade e horários.",
    capexHints: "Médio/alto (equipamentos, aluguel, reforma)",
    operations: ["turnos", "manutenção", "recepção", "planos"],
    marketingLocal: ["Google Maps", "parcerias", "indicação", "WhatsApp"],
    risks: ["sazonalidade", "churn de alunos", "concorrência de preço"],
  },
  {
    id: "restaurante",
    name: "Restaurante",
    summary: "Alimentação com experiência e operação de cozinha.",
    capexHints: "Alto (cozinha, alvarás, estoque inicial)",
    operations: ["cardápio enxuto", "CMV", "turnos", "delivery"],
    marketingLocal: ["Maps", "influenciadores locais", "delivery apps"],
    risks: ["margem", "desperdício", "equipe"],
  },
  {
    id: "hamburgueria",
    name: "Hamburgueria",
    summary: "Operação focus em ticket médio e velocidade.",
    capexHints: "Médio (ponto + equipamentos leves)",
    operations: ["ficha técnica", "tempo de produção", "delivery"],
    marketingLocal: ["fotos UGC", "combos", "parcerias bairro"],
    risks: ["comoditização", "delivery fee"],
  },
  {
    id: "arcade",
    name: "Arcade",
    summary: "Lazer com máquinas, tokens e eventos.",
    capexHints: "Alto (máquinas, espaço, manutenção)",
    operations: ["manutenção", "eventos", "snacks", "horários pico"],
    marketingLocal: ["escolas", "eventos", "aniversários"],
    risks: ["ociosidade em dias úteis", "CAPEX"],
  },
  {
    id: "bar",
    name: "Bar",
    summary: "Bebidas e socialização com pico noturno.",
    capexHints: "Médio/alto (ponto + estoque + licenças)",
    operations: ["comanda", "cardápio bar", "segurança", "horário"],
    marketingLocal: ["noites temáticas", "música", "Maps"],
    risks: ["regulamentação", "vizinhança", "estoque"],
  },
  {
    id: "clinica",
    name: "Clínica",
    summary: "Serviços de saúde/estética com agenda e compliance.",
    capexHints: "Médio/alto (sala, equipamentos, licenças)",
    operations: ["agenda", "prontuário", "protocolos", "recepção"],
    marketingLocal: ["indicação médica", "Google", "parcerias"],
    risks: ["compliance", "no-show", "reputação"],
  },
  {
    id: "escola",
    name: "Escola / curso presencial",
    summary: "Educação local com turmas e calendário.",
    capexHints: "Médio (salas, material, professores)",
    operations: ["matrículas", "calendário", "corpo docente"],
    marketingLocal: ["indicações", "aulas abertas", "parcerias"],
    risks: ["ocupação de turma", "inadimplência"],
  },
  {
    id: "loja",
    name: "Loja",
    summary: "Varejo físico com giro de estoque.",
    capexHints: "Médio (ponto + estoque inicial)",
    operations: ["giro", "vitrine", "PDV", "reposição"],
    marketingLocal: ["vizinhança", "Maps", "promoções"],
    risks: ["estoque parado", "aluguel"],
  },
  {
    id: "agencia",
    name: "Agência local",
    summary: "Serviços criativos/marketing para empresas da cidade.",
    capexHints: "Baixo/médio (home/office enxuto)",
    operations: ["pipeline", "entrega", "retainer"],
    marketingLocal: ["networking", "LinkedIn + presencial", "cases"],
    risks: ["dependência de fundador", "escopo"],
  },
  {
    id: "franquia",
    name: "Franquia",
    summary: "Modelo licenciado com playbook e royalties.",
    capexHints: "Variável conforme franquia (alta a muito alta)",
    operations: ["padrão da marca", "royalties", "auditoria"],
    marketingLocal: ["marca nacional + ação local"],
    risks: ["royalties", "pouca flexibilidade", "território"],
  },
  {
    id: "salao",
    name: "Salão",
    summary: "Beleza e bem-estar com agenda de profissionais.",
    capexHints: "Médio (cadeiras, reforma, estoque)",
    operations: ["agenda", "comissionamento", "retenção"],
    marketingLocal: ["Instagram", "indicação", "WhatsApp"],
    risks: ["no-show", "turnover de equipe"],
  },
  {
    id: "studio",
    name: "Studio",
    summary: "Espaço especializado (foto, pilates, podcast, etc.).",
    capexHints: "Médio (equipamentos/nicho)",
    operations: ["booking", "pacotes", "parcerias"],
    marketingLocal: ["nicho digital + local", "collabs"],
    risks: ["ocupação", "equipamentos"],
  },
  {
    id: "coworking",
    name: "Coworking",
    summary: "Espaços compartilhados com planos mensais.",
    capexHints: "Alto (imóvel, mobília, internet)",
    operations: ["ocupação", "comunidade", "eventos", "salas"],
    marketingLocal: ["empresas vizinhas", "eventos", "parcerias"],
    risks: ["vacância", "overhead fixo"],
  },
];

const byId = new Map(LOCAL_BUSINESSES.map((d) => [d.id, d] as const));

export function listLocalBusinesses(): LocalBusinessDefinition[] {
  return [...LOCAL_BUSINESSES];
}

export function getLocalBusiness(
  id: LocalBusinessId
): LocalBusinessDefinition | undefined {
  return byId.get(id);
}
