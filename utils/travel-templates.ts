import type { TripChecklistCategoria } from "@/types/database";

export type TravelTemplateChecklistItem = {
  categoria: TripChecklistCategoria;
  titulo: string;
};

export type TravelTemplateEvento = {
  titulo: string;
  offsetDays: number;
  hora: string;
  local: string;
  descricao?: string;
};

export type TravelTemplate = {
  id: string;
  label: string;
  destino: string;
  nome: string;
  diasSugeridos: number;
  orcamentoSugerido: number;
  checklist: TravelTemplateChecklistItem[];
  eventos: TravelTemplateEvento[];
  notas: string;
};

export const DEFAULT_CHECKLIST: TravelTemplateChecklistItem[] = [
  { categoria: "documentos", titulo: "Documentos organizados" },
  { categoria: "passaporte", titulo: "Passaporte válido (6+ meses)" },
  { categoria: "visto", titulo: "Visto ou autorização de entrada" },
  { categoria: "ingressos", titulo: "Ingressos e reservas confirmados" },
  { categoria: "hospedagem", titulo: "Hospedagem reservada" },
  { categoria: "seguro", titulo: "Seguro viagem contratado" },
  { categoria: "transporte", titulo: "Voos e transporte local" },
];

export const TRAVEL_TEMPLATES: Record<string, TravelTemplate> = {
  "disney-nba": {
    id: "disney-nba",
    label: "Disney + NBA Experience",
    nome: "Disney + NBA Experience",
    destino: "Orlando, FL — Walt Disney World",
    diasSugeridos: 7,
    orcamentoSugerido: 25000,
    notas:
      "Pacote Disney + NBA Experience: parques WDW, ESPN Wide World of Sports e jogo NBA.",
    checklist: [
      ...DEFAULT_CHECKLIST,
      { categoria: "ingressos", titulo: "Ingressos Disney (4+ dias)" },
      { categoria: "ingressos", titulo: "NBA Experience — ingressos do jogo" },
      { categoria: "ingressos", titulo: "Genie+ / Lightning Lane" },
      { categoria: "hospedagem", titulo: "Hotel Disney ou parceiro" },
      { categoria: "transporte", titulo: "Transfer aeroporto MCO → hotel" },
      { categoria: "documentos", titulo: "ESTA / autorização EUA" },
      { categoria: "seguro", titulo: "Seguro viagem internacional" },
    ],
    eventos: [
      {
        titulo: "Voo ida — Orlando",
        offsetDays: 0,
        hora: "14:00",
        local: "Aeroporto MCO",
        descricao: "Chegada e check-in no hotel Disney.",
      },
      {
        titulo: "Magic Kingdom",
        offsetDays: 1,
        hora: "08:00",
        local: "Magic Kingdom",
        descricao: "Dia 1 — parque principal.",
      },
      {
        titulo: "EPCOT",
        offsetDays: 2,
        hora: "09:00",
        local: "EPCOT",
      },
      {
        titulo: "Hollywood Studios",
        offsetDays: 3,
        hora: "09:00",
        local: "Hollywood Studios",
      },
      {
        titulo: "Animal Kingdom",
        offsetDays: 4,
        hora: "08:30",
        local: "Animal Kingdom",
      },
      {
        titulo: "NBA Experience — jogo",
        offsetDays: 5,
        hora: "19:00",
        local: "ESPN Wide World of Sports",
        descricao: "NBA Experience no complexo Disney.",
      },
      {
        titulo: "Disney Springs",
        offsetDays: 6,
        hora: "18:00",
        local: "Disney Springs",
        descricao: "Compras e jantar de despedida.",
      },
      {
        titulo: "Voo volta",
        offsetDays: 7,
        hora: "16:00",
        local: "Aeroporto MCO",
      },
    ],
  },
};

export const TRAVEL_TEMPLATE_LIST = Object.values(TRAVEL_TEMPLATES);

export function getTravelTemplate(id: string | null | undefined): TravelTemplate | null {
  if (!id) return null;
  return TRAVEL_TEMPLATES[id] ?? null;
}

export function addDaysToIsoDate(isoDate: string, days: number): string {
  const date = new Date(`${isoDate}T12:00:00`);
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}
