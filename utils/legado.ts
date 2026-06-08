import type {
  LegacyAchievement,
  LegacyCategoria,
  LegacyCertificate,
  LegacyLifeEvent,
  LegacyMilestone,
  LegacyTimeline,
  TableInsert,
} from "@/types/database";

export const LEGACY_START_YEAR = 2016;

export const LEGACY_CATEGORIAS: { id: LegacyCategoria; label: string }[] = [
  { id: "ginastica", label: "Ginástica" },
  { id: "danca", label: "Dança" },
  { id: "teatro", label: "Teatro" },
  { id: "empreendedorismo", label: "Empreendedorismo" },
  { id: "tecnologia", label: "Tecnologia" },
  { id: "viagens", label: "Viagens" },
  { id: "vida_pessoal", label: "Vida pessoal" },
];

export const LEGACY_ACHIEVEMENT_TIPOS: { id: string; label: string }[] = [
  { id: "medalha", label: "Medalha" },
  { id: "trofeu", label: "Troféu" },
  { id: "vaga", label: "Vaga conquistada" },
  { id: "conquista_pessoal", label: "Conquista pessoal" },
  { id: "outro", label: "Outro" },
];

export const LEGACY_MILESTONE_TIPOS: { id: string; label: string }[] = [
  { id: "inicio_ginastica", label: "Início da ginástica" },
  { id: "inicio_danca", label: "Início da dança" },
  { id: "inicio_teatro", label: "Início do teatro" },
  { id: "primeiro_cliente_alvesz", label: "Primeiro cliente Alvesz" },
  { id: "criacao_aura", label: "Criação da Aura" },
  { id: "noivado", label: "Noivado" },
  { id: "viagem_internacional", label: "Viagem internacional" },
  { id: "conquista_futura", label: "Conquista futura" },
  { id: "outro", label: "Outro" },
];

export const LEGACY_IA_ACTIONS = [
  {
    id: "contar-historia",
    label: "Conte minha história",
    prompt: "Conte minha história de vida com base nos dados do legado.",
  },
  {
    id: "maiores-conquistas",
    label: "Maiores conquistas",
    prompt: "Quais foram minhas maiores conquistas?",
  },
  {
    id: "evolucao-2016",
    label: "Evolução desde 2016",
    prompt: "Quanto evoluí desde 2016?",
  },
  {
    id: "padroes-trajetoria",
    label: "Padrões na trajetória",
    prompt: "Quais padrões existem na minha trajetória?",
  },
  {
    id: "lembrar-conquistas",
    label: "Lembrar conquistas",
    prompt: "Me lembre do que já conquistei.",
  },
] as const;

export type LegacyIaActionId = (typeof LEGACY_IA_ACTIONS)[number]["id"];

export const LEGACY_CATEGORY_LABELS: Record<LegacyCategoria, string> =
  Object.fromEntries(LEGACY_CATEGORIAS.map((c) => [c.id, c.label])) as Record<
    LegacyCategoria,
    string
  >;

export const LEGACY_AI_CONTEXT = `Você é a Aura Legado — guardiã da trajetória de vida de Anderson Alves.

Use APENAS os dados reais do legado fornecidos (timeline, conquistas, certificados, eventos e marcos).
Responda em português do Brasil, tom inspirador e preciso.
Conecte ginástica, dança, teatro, empreendedorismo (Alvesz), tecnologia (Aura), viagens e vida pessoal.
Nunca invente conquistas que não estejam nos dados.`;

export type LegacyDashboardMetrics = {
  anosTrajetoria: number;
  conquistasRegistradas: number;
  medalhas: number;
  certificados: number;
  viagens: number;
  marcosVida: number;
};

export type LegacyData = {
  timeline: LegacyTimeline[];
  achievements: LegacyAchievement[];
  certificates: LegacyCertificate[];
  lifeEvents: LegacyLifeEvent[];
  milestones: LegacyMilestone[];
};

export function getLegacyCategoryLabel(categoria: LegacyCategoria): string {
  return LEGACY_CATEGORY_LABELS[categoria] ?? categoria;
}

export function computeLegacyMetrics(data: LegacyData): LegacyDashboardMetrics {
  const years = new Set<number>();
  for (const t of data.timeline) years.add(t.ano);
  for (const a of data.achievements) years.add(a.ano);
  for (const c of data.certificates) years.add(c.ano);

  const minYear = years.size > 0 ? Math.min(...years) : LEGACY_START_YEAR;
  const currentYear = new Date().getFullYear();

  return {
    anosTrajetoria: Math.max(1, currentYear - minYear + 1),
    conquistasRegistradas: data.achievements.length,
    medalhas: data.achievements.filter((a) => a.tipo === "medalha" || a.tipo === "trofeu").length,
    certificados: data.certificates.length,
    viagens: data.lifeEvents.filter((e) => e.categoria === "viagens" || e.tipo_evento === "viagem").length +
      data.milestones.filter((m) => m.tipo_marco === "viagem_internacional").length,
    marcosVida: data.milestones.length,
  };
}

export function buildTimelineYears(
  timeline: LegacyTimeline[],
  startYear = LEGACY_START_YEAR
): { year: number; items: LegacyTimeline[] }[] {
  const currentYear = new Date().getFullYear();
  const years: { year: number; items: LegacyTimeline[] }[] = [];

  for (let y = startYear; y <= currentYear; y++) {
    const items = timeline
      .filter((t) => t.ano === y)
      .sort((a, b) => (a.mes ?? 0) - (b.mes ?? 0) || a.ordem - b.ordem);
    years.push({ year: y, items });
  }

  return years;
}

export function filterHallOfFame<T extends { categoria: LegacyCategoria; ano: number }>(
  items: T[],
  filters: { ano?: number | "all"; categoria?: LegacyCategoria | "all" }
): T[] {
  return items.filter((item) => {
    if (filters.ano && filters.ano !== "all" && item.ano !== filters.ano) return false;
    if (
      filters.categoria &&
      filters.categoria !== "all" &&
      item.categoria !== filters.categoria
    ) {
      return false;
    }
    return true;
  });
}

export function getLegacyYearOptions(
  data: LegacyData
): number[] {
  const years = new Set<number>();
  for (const t of data.timeline) years.add(t.ano);
  for (const a of data.achievements) years.add(a.ano);
  for (const c of data.certificates) years.add(c.ano);
  return [...years].sort((a, b) => b - a);
}

export function buildLegacyContext(data: LegacyData): string {
  const metrics = computeLegacyMetrics(data);

  const timelineLines =
    data.timeline.length > 0
      ? data.timeline
          .slice(0, 20)
          .map(
            (t) =>
              `* ${t.ano}${t.mes ? `/${String(t.mes).padStart(2, "0")}` : ""} — ${t.titulo} (${getLegacyCategoryLabel(t.categoria)})`
          )
          .join("\n")
      : "Nenhum registro na timeline.";

  const achievementLines =
    data.achievements.length > 0
      ? data.achievements
          .slice(0, 15)
          .map(
            (a) =>
              `* ${a.ano} — ${a.titulo} [${a.tipo}] (${getLegacyCategoryLabel(a.categoria)})${a.local ? ` — ${a.local}` : ""}`
          )
          .join("\n")
      : "Nenhuma conquista registrada.";

  const certificateLines =
    data.certificates.length > 0
      ? data.certificates
          .slice(0, 10)
          .map((c) => `* ${c.ano} — ${c.titulo}${c.instituicao ? ` (${c.instituicao})` : ""}`)
          .join("\n")
      : "Nenhum certificado registrado.";

  const eventLines =
    data.lifeEvents.length > 0
      ? data.lifeEvents
          .slice(0, 10)
          .map((e) => `* ${e.data_evento.slice(0, 10)} — ${e.titulo}`)
          .join("\n")
      : "Nenhum evento de vida registrado.";

  const milestoneLines =
    data.milestones.length > 0
      ? data.milestones
          .map(
            (m) =>
              `* ${m.titulo} (${m.status})${m.data_marco ? ` — ${m.data_marco.slice(0, 10)}` : ""}`
          )
          .join("\n")
      : "Nenhum marco de vida registrado.";

  return `## LEGADO & HALL DA FAMA — Anderson Alves

### MÉTRICAS
Anos de trajetória: ${metrics.anosTrajetoria}
Conquistas: ${metrics.conquistasRegistradas}
Medalhas/troféus: ${metrics.medalhas}
Certificados: ${metrics.certificados}
Viagens: ${metrics.viagens}
Marcos de vida: ${metrics.marcosVida}

### TIMELINE (${LEGACY_START_YEAR} → hoje)
${timelineLines}

### HALL DA FAMA
${achievementLines}

### CERTIFICADOS
${certificateLines}

### EVENTOS DE VIDA
${eventLines}

### MARCOS DE VIDA
${milestoneLines}`;
}

type SeedRow<T> = Omit<T, "id" | "user_id" | "created_at" | "updated_at">;

export function buildAndersonLegacySeed(userId: string): {
  timeline: TableInsert<"legacy_timeline">[];
  achievements: TableInsert<"legacy_achievements">[];
  certificates: TableInsert<"legacy_certificates">[];
  lifeEvents: TableInsert<"legacy_life_events">[];
  milestones: TableInsert<"legacy_milestones">[];
} {
  const withUser = <T extends Record<string, unknown>>(rows: T[]) =>
    rows.map((r) => ({ ...r, user_id: userId }));

  const timeline: SeedRow<LegacyTimeline>[] = [
    { titulo: "Início na ginástica artística", descricao: "Começo da trajetória como atleta de ginástica em Indaiatuba.", categoria: "ginastica", ano: 2016, mes: 3, ordem: 1 },
    { titulo: "Competições regionais de ginástica", descricao: "Participação em campeonatos regionais e estaduais.", categoria: "ginastica", ano: 2017, mes: null, ordem: 2 },
    { titulo: "Evolução técnica e disciplina", descricao: "Consolidação da rotina de treinos e competições.", categoria: "ginastica", ano: 2019, mes: null, ordem: 3 },
    { titulo: "Recuperação do ombro", descricao: "Fase de reabilitação e retorno gradual aos treinos.", categoria: "ginastica", ano: 2023, mes: 6, ordem: 4 },
    { titulo: "Início da dança", descricao: "Primeiros passos na dança contemporânea e urbana.", categoria: "danca", ano: 2021, mes: 1, ordem: 5 },
    { titulo: "Apresentações de dança", descricao: "Participação em apresentações e workshops.", categoria: "danca", ano: 2022, mes: null, ordem: 6 },
    { titulo: "Início no teatro", descricao: "Entrada no mundo do teatro e artes cênicas.", categoria: "teatro", ano: 2022, mes: 8, ordem: 7 },
    { titulo: "Alvesz Experience", descricao: "Lançamento do negócio de bartender premium para eventos.", categoria: "empreendedorismo", ano: 2024, mes: 1, ordem: 8 },
    { titulo: "Crescimento Alvesz", descricao: "Casamentos, corporativos e eventos premium em Indaiatuba e região.", categoria: "empreendedorismo", ano: 2024, mes: 6, ordem: 9 },
    { titulo: "Desenvolvimento da Aura OS", descricao: "Criação do sistema pessoal de gestão de vida Aura.", categoria: "tecnologia", ano: 2026, mes: 1, ordem: 10 },
    { titulo: "Viagem Argentina", descricao: "Primeira grande viagem internacional.", categoria: "viagens", ano: 2025, mes: 3, ordem: 11 },
    { titulo: "Preparação Disney + NBA", descricao: "Planejamento da viagem dos sonhos para Orlando.", categoria: "viagens", ano: 2025, mes: 6, ordem: 12 },
    { titulo: "Noivado", descricao: "Marco pessoal: compromisso com a pessoa amada.", categoria: "vida_pessoal", ano: 2024, mes: 12, ordem: 13 },
  ];

  const achievements: SeedRow<LegacyAchievement>[] = [
    { titulo: "Medalha em competição regional", descricao: "Pódio em campeonato regional de ginástica.", tipo: "medalha", categoria: "ginastica", ano: 2018, local: "Interior de SP", ordem: 1 },
    { titulo: "Troféu campeonato estadual", descricao: "Conquista em etapa estadual de ginástica.", tipo: "trofeu", categoria: "ginastica", ano: 2019, local: "São Paulo", ordem: 2 },
    { titulo: "Vaga em grupo de dança", descricao: "Selecionado para grupo de apresentações.", tipo: "vaga", categoria: "danca", ano: 2022, local: "Indaiatuba", ordem: 3 },
    { titulo: "Destaque em apresentação teatral", descricao: "Reconhecimento em peça teatral local.", tipo: "conquista_pessoal", categoria: "teatro", ano: 2023, local: "Indaiatuba", ordem: 4 },
    { titulo: "Primeiro evento Alvesz fechado", descricao: "Primeiro casamento com Alvesz Experience.", tipo: "conquista_pessoal", categoria: "empreendedorismo", ano: 2024, local: "Indaiatuba", ordem: 5 },
    { titulo: "10 eventos Alvesz realizados", descricao: "Marca de 10 eventos premium entregues.", tipo: "trofeu", categoria: "empreendedorismo", ano: 2025, local: "Região de Campinas", ordem: 6 },
    { titulo: "Aura OS em produção", descricao: "Sistema pessoal de gestão de vida no ar.", tipo: "conquista_pessoal", categoria: "tecnologia", ano: 2026, local: null, ordem: 7 },
  ];

  const certificates: SeedRow<LegacyCertificate>[] = [
    { titulo: "Certificado de Ginástica Artística", instituicao: "Federação Paulista", categoria: "ginastica", ano: 2018, descricao: "Formação e competições oficiais.", ordem: 1 },
    { titulo: "Workshop de Dança Contemporânea", instituicao: "Escola de Dança", categoria: "danca", ano: 2021, descricao: "Intensivo de técnica e expressão.", ordem: 2 },
    { titulo: "Curso de Bartender Premium", instituicao: "Escola de Coquetelaria", categoria: "empreendedorismo", ano: 2023, descricao: "Drinks autorais e experiência em eventos.", ordem: 3 },
  ];

  const lifeEvents: SeedRow<LegacyLifeEvent>[] = [
    { titulo: "Primeira competição de ginástica", descricao: "Debut em competição oficial.", categoria: "ginastica", data_evento: "2017-05-15", tipo_evento: "competicao", ordem: 1 },
    { titulo: "Apresentação de dança", descricao: "Primeira apresentação pública de dança.", categoria: "danca", data_evento: "2022-04-20", tipo_evento: "apresentacao", ordem: 2 },
    { titulo: "Estreia no teatro", descricao: "Primeira peça teatral.", categoria: "teatro", data_evento: "2022-11-10", tipo_evento: "apresentacao", ordem: 3 },
    { titulo: "Viagem à Argentina", descricao: "Buenos Aires e experiências internacionais.", categoria: "viagens", data_evento: "2025-03-10", tipo_evento: "viagem", ordem: 4 },
    { titulo: "Noivado", descricao: "Pedido de casamento.", categoria: "vida_pessoal", data_evento: "2024-12-24", tipo_evento: "pessoal", ordem: 5 },
  ];

  const milestones: SeedRow<LegacyMilestone>[] = [
    { titulo: "Início da ginástica", descricao: "Começo da trajetória como ginasta.", categoria: "ginastica", data_marco: "2016-03-01", tipo_marco: "inicio_ginastica", status: "concluido", ordem: 1 },
    { titulo: "Início da dança", descricao: "Primeiro contato com dança.", categoria: "danca", data_marco: "2021-01-15", tipo_marco: "inicio_danca", status: "concluido", ordem: 2 },
    { titulo: "Início do teatro", descricao: "Entrada no teatro.", categoria: "teatro", data_marco: "2022-08-01", tipo_marco: "inicio_teatro", status: "concluido", ordem: 3 },
    { titulo: "Primeiro cliente Alvesz", descricao: "Primeiro evento fechado com Alvesz Experience.", categoria: "empreendedorismo", data_marco: "2024-03-15", tipo_marco: "primeiro_cliente_alvesz", status: "concluido", ordem: 4 },
    { titulo: "Noivado", descricao: "Compromisso de casamento.", categoria: "vida_pessoal", data_marco: "2024-12-24", tipo_marco: "noivado", status: "concluido", ordem: 5 },
    { titulo: "Viagem Argentina 2025", descricao: "Primeira viagem internacional registrada.", categoria: "viagens", data_marco: "2025-03-10", tipo_marco: "viagem_internacional", status: "concluido", ordem: 6 },
    { titulo: "Disney + NBA 2025", descricao: "Viagem dos sonhos para Orlando.", categoria: "viagens", data_marco: "2025-11-01", tipo_marco: "viagem_internacional", status: "em_andamento", ordem: 7 },
    { titulo: "Criação da Aura", descricao: "Sistema pessoal de gestão de vida.", categoria: "tecnologia", data_marco: "2026-01-01", tipo_marco: "criacao_aura", status: "concluido", ordem: 8 },
    { titulo: "Recuperação total do ombro", descricao: "Meta futura: retorno completo às competições.", categoria: "ginastica", data_marco: null, tipo_marco: "conquista_futura", status: "futuro", ordem: 9 },
  ];

  return {
    timeline: withUser(timeline),
    achievements: withUser(achievements),
    certificates: withUser(certificates),
    lifeEvents: withUser(lifeEvents),
    milestones: withUser(milestones),
  };
}

export function isLegacyEmpty(data: LegacyData): boolean {
  return (
    data.timeline.length === 0 &&
    data.achievements.length === 0 &&
    data.certificates.length === 0 &&
    data.lifeEvents.length === 0 &&
    data.milestones.length === 0
  );
}
