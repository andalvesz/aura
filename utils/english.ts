import type {
  LanguageLesson,
  LanguageModo,
  LanguageProgress,
  LanguageSession,
} from "@/types/database";
import { todayIsoDate } from "@/utils/health";

function toIsoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function getWeekRangeLocal(reference = new Date()): { start: string; end: string } {
  const end = new Date(reference);
  const start = new Date(reference);
  start.setDate(start.getDate() - 6);
  return { start: toIsoDate(start), end: toIsoDate(end) };
}

function isInDateRangeLocal(iso: string, start: string, end: string): boolean {
  const d = iso.slice(0, 10);
  return d >= start && d <= end;
}

export const ENGLISH_MODOS = [
  { id: "viagens", label: "Inglês para viagens" },
  { id: "aeroporto", label: "Inglês para aeroporto" },
  { id: "hotel", label: "Inglês para hotel" },
  { id: "disney", label: "Inglês para Disney" },
  { id: "nba", label: "Inglês para NBA" },
  { id: "negocios", label: "Inglês para negócios" },
  { id: "conversacao_livre", label: "Conversação livre" },
] as const;

export const ENGLISH_COACH_ACTIONS = [
  "aula-diaria",
  "vocabulario",
  "frases-uteis",
  "exercicios",
  "correcao",
  "simular-conversa",
] as const;

export type EnglishCoachAction = (typeof ENGLISH_COACH_ACTIONS)[number];

export type EnglishCoachMode =
  | "chat"
  | "aula_diaria"
  | "vocabulario"
  | "frases"
  | "exercicio"
  | "correcao"
  | "conversacao";

export type ParsedEnglishLesson = {
  titulo: string;
  introducao: string;
  vocabulario: { termo: string; traducao: string; exemplo: string }[];
  frases: { ingles: string; portugues: string; contexto: string }[];
  exercicios: {
    pergunta: string;
    opcoes?: string[];
    resposta_esperada: string;
    dica?: string;
  }[];
  dicas: string[];
};

export type ParsedEnglishCorrection = {
  correcao: string;
  explicacao: string;
  versao_melhorada: string;
  nota: number;
};

export const ENGLISH_COACH_CONTEXT = `Você é a Aura English Coach — tutora de inglês personalizada para Anderson Alves.

## PERFIL DO ALUNO
- Nome: Anderson Alves · Indaiatuba, SP
- Objetivos: viagens (Disney, NBA, Orlando), aeroporto, hotel, negócios (Alvesz Experience, consórcios), conversação
- Interesses: dança, ginástica, teatro, eventos premium, marca @and.alvesz
- Nível estimado: intermediário — adapte explicações em português quando necessário

## ESTILO
- Tom motivador, prático e direto
- Traduza conceitos difíceis; use inglês nos exemplos e frases
- Foque em situações reais dos objetivos do Anderson
- Nunca invente progresso; use os dados reais fornecidos`;

export const ENGLISH_AURA_COACH_PHRASES = [
  "me de uma aula de ingles",
  "me dê uma aula de inglês",
  "aula de ingles",
  "aula de inglês",
  "treinar ingles para aeroporto",
  "treinar inglês para aeroporto",
  "ingles para aeroporto",
  "inglês para aeroporto",
  "simular conversa na disney",
  "simular conversa disney",
  "conversa na disney",
  "english coach",
  "aura english",
  "praticar ingles",
  "praticar inglês",
] as const;

export function isEnglishCoachAction(id: string): id is EnglishCoachAction {
  return (ENGLISH_COACH_ACTIONS as readonly string[]).includes(id);
}

export function getEnglishModoLabel(modo: string): string {
  return ENGLISH_MODOS.find((m) => m.id === modo)?.label ?? modo;
}

export function isValidLanguageModo(value: string): value is LanguageModo {
  return ENGLISH_MODOS.some((m) => m.id === value);
}

export function computeLanguageStreak(
  currentStreak: number,
  lastPractice: string | null,
  today = todayIsoDate()
): { streak_dias: number; ultima_pratica: string } {
  if (lastPractice === today) {
    return { streak_dias: currentStreak, ultima_pratica: today };
  }

  const yesterday = new Date(`${today}T12:00:00`);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayIso = yesterday.toISOString().slice(0, 10);

  if (lastPractice === yesterdayIso) {
    return { streak_dias: currentStreak + 1, ultima_pratica: today };
  }

  return { streak_dias: 1, ultima_pratica: today };
}

export type WeeklyLanguageStats = {
  sessoes: number;
  aulasConcluidas: number;
  exerciciosConcluidos: number;
  minutosEstudo: number;
  diasAtivos: number;
};

export function computeWeeklyLanguageStats(
  sessions: LanguageSession[],
  lessons: LanguageLesson[],
  reference = new Date()
): WeeklyLanguageStats {
  const { start, end } = getWeekRangeLocal(reference);
  const inRange = (iso: string | null | undefined) =>
    iso ? isInDateRangeLocal(iso, start, end) : false;

  const weekSessions = sessions.filter((s) => inRange(s.data));
  const weekLessons = lessons.filter(
    (l) => l.status === "concluido" && inRange(l.concluido_em ?? l.created_at)
  );

  return {
    sessoes: weekSessions.length,
    aulasConcluidas: weekLessons.length,
    exerciciosConcluidos: weekSessions.filter(
      (s) => s.tipo === "exercicio" && s.status === "concluido" && inRange(s.data)
    ).length,
    minutosEstudo: weekSessions.reduce((sum, s) => sum + s.duracao_min, 0),
    diasAtivos: new Set(weekSessions.map((s) => s.data)).size,
  };
}

export function buildLanguageReportLines(
  progress: LanguageProgress | null,
  sessions: LanguageSession[],
  lessons: LanguageLesson[],
  reference = new Date()
): string[] {
  const stats = computeWeeklyLanguageStats(sessions, lessons, reference);

  if (!progress && stats.sessoes === 0 && stats.aulasConcluidas === 0) {
    return ["Nenhuma prática de inglês registrada nesta semana."];
  }

  return [
    `Streak atual: ${progress?.streak_dias ?? 0} dias`,
    `Sessões na semana: ${stats.sessoes}`,
    `Aulas concluídas: ${stats.aulasConcluidas}`,
    `Exercícios concluídos: ${stats.exerciciosConcluidos}`,
    `Minutos de estudo: ${stats.minutosEstudo}`,
    `Dias ativos: ${stats.diasAtivos}`,
    progress?.modo_favorito
      ? `Modo favorito: ${getEnglishModoLabel(progress.modo_favorito)}`
      : "Modo favorito: não definido",
  ];
}

export function getStreakEmoji(streak: number): string {
  if (streak >= 30) return "🏆";
  if (streak >= 7) return "🔥🔥🔥";
  if (streak >= 3) return "🔥🔥";
  if (streak >= 1) return "🔥";
  return "";
}

export function buildEnglishCoachDataContext(
  progress: LanguageProgress | null,
  sessions: LanguageSession[],
  lessons: LanguageLesson[]
): string {
  const today = todayIsoDate();
  const sessionsHoje = sessions.filter((s) => s.data === today);
  const lessonsPendentes = lessons.filter((l) => l.status !== "concluido").length;
  const lessonsConcluidas = lessons.filter((l) => l.status === "concluido").length;

  const progressBlock = progress
    ? `Streak: ${progress.streak_dias} dias
Última prática: ${progress.ultima_pratica ?? "nunca"}
Aulas concluídas: ${progress.aulas_concluidas}
Exercícios concluídos: ${progress.exercicios_concluidos}
Módulos concluídos: ${progress.modulos_concluidos}
Nível: ${progress.nivel}
Modo favorito: ${progress.modo_favorito ? getEnglishModoLabel(progress.modo_favorito) : "não definido"}`
    : "Nenhum progresso registrado ainda.";

  const recentSessions = sessions
    .slice(0, 5)
    .map(
      (s) =>
        `* ${s.titulo} (${getEnglishModoLabel(s.modo)}, ${s.tipo}, ${s.status}) — ${s.data}`
    )
    .join("\n");

  return `## DADOS REAIS — ENGLISH COACH
${progressBlock}

Sessões hoje: ${sessionsHoje.length}
Lições pendentes: ${lessonsPendentes}
Lições concluídas: ${lessonsConcluidas}

### Sessões recentes
${recentSessions || "Nenhuma sessão registrada."}`;
}

export function parseEnglishLesson(raw: Partial<ParsedEnglishLesson>): ParsedEnglishLesson {
  return {
    titulo: String(raw.titulo ?? "Aula de inglês").trim(),
    introducao: String(raw.introducao ?? "").trim(),
    vocabulario: Array.isArray(raw.vocabulario)
      ? raw.vocabulario.map((v) => ({
          termo: String(v.termo ?? "").trim(),
          traducao: String(v.traducao ?? "").trim(),
          exemplo: String(v.exemplo ?? "").trim(),
        }))
      : [],
    frases: Array.isArray(raw.frases)
      ? raw.frases.map((f) => ({
          ingles: String(f.ingles ?? "").trim(),
          portugues: String(f.portugues ?? "").trim(),
          contexto: String(f.contexto ?? "").trim(),
        }))
      : [],
    exercicios: Array.isArray(raw.exercicios)
      ? raw.exercicios.map((e) => ({
          pergunta: String(e.pergunta ?? "").trim(),
          opcoes: Array.isArray(e.opcoes)
            ? e.opcoes.map((o) => String(o).trim())
            : undefined,
          resposta_esperada: String(e.resposta_esperada ?? "").trim(),
          dica: e.dica ? String(e.dica).trim() : undefined,
        }))
      : [],
    dicas: Array.isArray(raw.dicas)
      ? raw.dicas.map((d) => String(d).trim()).filter(Boolean)
      : [],
  };
}

export function parseEnglishCorrection(
  raw: Partial<ParsedEnglishCorrection>
): ParsedEnglishCorrection {
  return {
    correcao: String(raw.correcao ?? "").trim(),
    explicacao: String(raw.explicacao ?? "").trim(),
    versao_melhorada: String(raw.versao_melhorada ?? "").trim(),
    nota: Number(raw.nota) || 0,
  };
}

export function detectEnglishModoFromMessage(message: string): LanguageModo {
  const n = message
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  if (n.includes("aeroporto")) return "aeroporto";
  if (n.includes("hotel")) return "hotel";
  if (n.includes("disney")) return "disney";
  if (n.includes("nba")) return "nba";
  if (n.includes("negocio") || n.includes("business")) return "negocios";
  if (n.includes("conversacao") || n.includes("conversa livre")) return "conversacao_livre";
  if (n.includes("viagem") || n.includes("travel")) return "viagens";
  return "viagens";
}

export function isAuraEnglishCoachQuery(message: string): boolean {
  const n = message
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  return ENGLISH_AURA_COACH_PHRASES.some((phrase) => {
    const p = phrase
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
    return n.includes(p);
  });
}
