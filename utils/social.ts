import type { Conteudo } from "@/types/database";

export const CONTEUDO_STATUSES = [
  { id: "ideia", label: "Ideia" },
  { id: "roteiro", label: "Roteiro" },
  { id: "gravado", label: "Gravado" },
  { id: "editado", label: "Editado" },
  { id: "publicado", label: "Publicado" },
] as const;

export type ConteudoStatus = (typeof CONTEUDO_STATUSES)[number]["id"];

export const CONTEUDO_PLATAFORMAS = [
  "instagram",
  "youtube",
  "tiktok",
  "facebook",
] as const;

export const CONTEUDO_FORMATOS = [
  "reels",
  "stories",
  "carrossel",
  "video_longo",
  "live",
  "post",
] as const;

export function getConteudoStatusLabel(status: string) {
  return CONTEUDO_STATUSES.find((s) => s.id === status)?.label ?? status;
}

export function normalizeConteudoStatus(status: string): ConteudoStatus {
  const map: Record<string, ConteudoStatus> = {
    ideia: "ideia",
    planejado: "roteiro",
    analise: "ideia",
    roteiro: "roteiro",
    gravado: "gravado",
    editado: "editado",
    publicado: "publicado",
  };
  return map[status] ?? "ideia";
}

export function computeSocialMetrics(conteudos: Conteudo[]) {
  const normalized = conteudos.map((c) => ({
    ...c,
    status: normalizeConteudoStatus(c.status),
  }));

  const ideias = normalized.filter((c) => c.status === "ideia").length;
  const publicados = normalized.filter((c) => c.status === "publicado").length;
  const emProducao = normalized.filter((c) =>
    ["roteiro", "gravado", "editado"].includes(c.status)
  ).length;

  const porPlataforma = CONTEUDO_PLATAFORMAS.reduce(
    (acc, p) => {
      const items = normalized.filter((c) => c.plataforma === p);
      acc[p] = {
        planejados: items.filter((c) => c.status !== "publicado").length,
        publicados: items.filter((c) => c.status === "publicado").length,
      };
      return acc;
    },
    {} as Record<string, { planejados: number; publicados: number }>
  );

  return { ideias, publicados, emProducao, porPlataforma, normalized };
}

export function conteudosNaSemana(conteudos: Conteudo[]) {
  const now = new Date();
  const start = new Date(now);
  start.setDate(now.getDate() - ((now.getDay() + 6) % 7));
  start.setHours(0, 0, 0, 0);

  const dias = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
  return dias.map((day, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    const key = d.toISOString().slice(0, 10);
    const items = conteudos.filter((c) => {
      if (!c.data_publicacao) return false;
      return new Date(c.data_publicacao).toISOString().slice(0, 10) === key;
    });
    return { day, date: key, items };
  }).slice(0, 5);
}

export const SOCIAL_ROTEIRO_CONTEXT = `Contexto de marca:
- Anderson Alves — Indaiatuba, SP
- Alvesz Experience — bartender premium, casamentos, eventos corporativos
- Consórcios Ademicon
- Crescimento no Instagram @and.alvesz
- Vendas pela internet e captação via WhatsApp`;
