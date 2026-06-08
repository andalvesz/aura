import type { LegacyData } from "@/utils/legado";
import {
  computeLegacyMetrics,
  getLegacyCategoryLabel,
  isLegacyEmpty,
  LEGACY_START_YEAR,
} from "@/utils/legado";

export type IdentityCommand = "story" | "motivation";

export const AURA_IDENTITY_SYSTEM_INSTRUCTION = `## AURA IDENTITY — Contexto permanente
Use a trajetória real do usuário como base para personalizar respostas.
Considere: ginástica artística, dança (desde 2021), teatro, Alvesz Experience, Aura OS, viagens (Disney/NBA), relacionamento/noivado, liberdade financeira e valores pessoais.
Nunca invente conquistas ou fatos que não estejam nos dados do legado.`;

export const IDENTITY_STORY_PHRASES = [
  "use minha historia como base",
  "use minha história como base",
  "baseie na minha historia",
  "baseie na minha história",
  "use minha trajetoria como base",
  "use minha trajetória como base",
  "conte com base na minha historia",
  "conte com base na minha história",
] as const;

export const IDENTITY_MOTIVATION_PHRASES = [
  "me motive com base no que ja conquistei",
  "me motive com base no que já conquistei",
  "me motive com minhas conquistas",
  "me motive pelo meu legado",
  "me lembre do que ja conquistei",
  "me lembre do que já conquistei",
  "motivacao com base nas conquistas",
  "motivação com base nas conquistas",
] as const;

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function matchesAny(normalized: string, phrases: readonly string[]): boolean {
  return phrases.some((phrase) => normalized.includes(normalize(phrase)));
}

export function detectIdentityCommand(message: string): IdentityCommand | null {
  const normalized = normalize(message);
  if (!normalized) return null;

  if (matchesAny(normalized, IDENTITY_MOTIVATION_PHRASES)) {
    return "motivation";
  }
  if (matchesAny(normalized, IDENTITY_STORY_PHRASES)) {
    return "story";
  }

  return null;
}

export function buildIdentityCommandInstruction(command: IdentityCommand): string {
  if (command === "story") {
    return `O usuário pediu para usar a história dele como base.
Conte ou conecte a resposta à trajetória real registrada no legado.
Destaque ginástica, dança, teatro, Alvesz, Aura, viagens, noivado e evolução pessoal.
Tom inspirador e autêntico, sem inventar fatos.`;
  }

  return `O usuário pediu motivação com base no que já conquistou.
Use conquistas, medalhas, marcos e certificados reais do legado.
Reforce disciplina, resiliência e progresso — conecte passado e metas futuras (liberdade financeira, Disney/NBA, Aura OS).
Tom motivacional e específico, citando fatos reais.`;
}

function linesByCategory(
  data: LegacyData,
  categoria: LegacyData["timeline"][number]["categoria"],
  limit = 3
): string[] {
  const lines: string[] = [];

  for (const item of data.timeline.filter((t) => t.categoria === categoria).slice(0, limit)) {
    lines.push(`${item.ano}: ${item.titulo}`);
  }
  for (const item of data.achievements.filter((a) => a.categoria === categoria).slice(0, limit)) {
    if (lines.length >= limit) break;
    lines.push(`${item.ano}: ${item.titulo}`);
  }

  return lines.slice(0, limit);
}

export function buildIdentityContextSummary(
  data: LegacyData,
  displayName = "Usuário"
): string {
  const metrics = computeLegacyMetrics(data);

  const ginastica = linesByCategory(data, "ginastica");
  const danca = linesByCategory(data, "danca");
  const teatro = linesByCategory(data, "teatro");
  const empreendedorismo = linesByCategory(data, "empreendedorismo");
  const tecnologia = linesByCategory(data, "tecnologia");
  const viagens = linesByCategory(data, "viagens");
  const vidaPessoal = linesByCategory(data, "vida_pessoal");

  const topAchievements = data.achievements
    .slice(0, 8)
    .map((a) => `* ${a.ano} — ${a.titulo} (${getLegacyCategoryLabel(a.categoria)})`)
    .join("\n");

  const milestones = data.milestones
    .map((m) => `* ${m.titulo} [${m.status}]`)
    .join("\n");

  const pillarBlock = (label: string, lines: string[]) =>
    lines.length > 0 ? `**${label}:** ${lines.join("; ")}` : null;

  const pillars = [
    pillarBlock("Ginástica", ginastica),
    pillarBlock("Dança (desde 2021)", danca),
    pillarBlock("Teatro", teatro),
    pillarBlock("Alvesz Experience", empreendedorismo),
    pillarBlock("Aura OS", tecnologia),
    pillarBlock("Viagens (Disney/NBA)", viagens),
    pillarBlock("Vida pessoal", vidaPessoal),
  ]
    .filter(Boolean)
    .join("\n");

  return `${AURA_IDENTITY_SYSTEM_INSTRUCTION}

### Identidade — ${displayName}
Trajetória desde ${LEGACY_START_YEAR} · ${metrics.anosTrajetoria} anos · ${metrics.conquistasRegistradas} conquistas · ${metrics.medalhas} medalhas/troféus

${pillars || "Pilares ainda não detalhados no legado."}

### Conquistas principais
${topAchievements || "Nenhuma conquista registrada."}

### Marcos de vida
${milestones || "Nenhum marco registrado."}`;
}

export function buildIdentityContextFromData(
  data: LegacyData,
  displayName?: string
): string | null {
  if (isLegacyEmpty(data)) return null;
  return buildIdentityContextSummary(data, displayName);
}
