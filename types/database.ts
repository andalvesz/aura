export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Profile = {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
};

export type Gasto = {
  id: string;
  user_id: string;
  titulo: string;
  valor: number;
  categoria: string;
  data: string;
  created_at: string;
  updated_at: string;
};

export type Evento = {
  id: string;
  user_id: string;
  titulo: string;
  descricao: string | null;
  data_inicio: string;
  data_fim: string | null;
  local: string | null;
  tipo: string;
  growth_lead_id: string | null;
  created_at: string;
  updated_at: string;
};

export type Cliente = {
  id: string;
  user_id: string;
  nome: string;
  telefone: string | null;
  email: string | null;
  instagram: string | null;
  tipo: string;
  observacoes: string | null;
  created_at: string;
  updated_at: string;
};

export type Orcamento = {
  id: string;
  user_id: string;
  cliente_id: string | null;
  tipo_evento: string;
  convidados: number;
  valor_total: number;
  lucro_estimado: number;
  status: string;
  data_evento: string | null;
  local: string | null;
  growth_lead_id: string | null;
  created_at: string;
  updated_at: string;
};

export type EstoqueItem = {
  id: string;
  user_id: string;
  produto: string;
  quantidade: number;
  unidade: string;
  minimo_alerta: number;
  created_at: string;
  updated_at: string;
};

export type Treino = {
  id: string;
  user_id: string;
  titulo: string;
  categoria: string;
  exercicios: Json;
  created_at: string;
  updated_at: string;
};

export type DietaItem = {
  id: string;
  user_id: string;
  refeicao: string;
  horario: string;
  calorias: number;
  created_at: string;
  updated_at: string;
};

export type Conteudo = {
  id: string;
  user_id: string;
  plataforma: string;
  titulo: string;
  status: string;
  data_publicacao: string | null;
  formato: string | null;
  objetivo: string | null;
  observacoes: string | null;
  roteiro: string | null;
  created_at: string;
  updated_at: string;
};

export type AlveszEvento = {
  id: string;
  user_id: string;
  titulo: string;
  data_evento: string;
  local: string | null;
  cliente_id: string | null;
  valor_fechado: number;
  evento_calendario_id: string | null;
  created_at: string;
  updated_at: string;
};

export type Lead = {
  id: string;
  user_id: string;
  nome: string;
  telefone: string | null;
  origem: string;
  status: string;
  observacoes: string | null;
  created_at: string;
  updated_at: string;
};

export type AiMessage = {
  id: string;
  user_id: string;
  module: string;
  role: "user" | "assistant" | "system";
  content: string;
  metadata: Json;
  created_at: string;
};

export type GrowthGoal = {
  id: string;
  user_id: string;
  meta_receita_mensal: number;
  receita_atual: number;
  xp_total: number;
  nivel: number;
  mes_referencia: string;
  created_at: string;
  updated_at: string;
};

export type GrowthMissionStatus = "pending" | "completed";

export type GrowthMission = {
  id: string;
  user_id: string;
  mission_key: string;
  titulo: string;
  descricao: string;
  xp_reward: number;
  status: GrowthMissionStatus;
  mission_date: string;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type GrowthVertical = "alvesz" | "consorcios" | "marca_pessoal";

export type GrowthAction = {
  id: string;
  user_id: string;
  vertical: GrowthVertical;
  oferta_principal: string | null;
  canal_venda: string | null;
  publico_alvo: string | null;
  cta: string | null;
  funil: string | null;
  ideias_acao: string | null;
  created_at: string;
  updated_at: string;
};

export type GrowthProfile = {
  id: string;
  user_id: string;
  plataforma: string;
  username: string;
  nicho: string | null;
  objetivo: string | null;
  observacoes: string | null;
  created_at: string;
  updated_at: string;
};

export type GrowthAnalysisStatus = "pending" | "completed" | "failed";

export type GrowthAnalysis = {
  id: string;
  user_id: string;
  profile_id: string | null;
  conteudo: string | null;
  status: GrowthAnalysisStatus;
  created_at: string;
  updated_at: string;
};

export type GrowthLeadStatus =
  | "novo"
  | "contato"
  | "proposta"
  | "negociacao"
  | "fechado"
  | "perdido";

export type GrowthLeadCanal = "instagram" | "whatsapp" | "indicacao" | "outro";

export type GrowthLead = {
  id: string;
  user_id: string;
  origem: string;
  nome: string;
  contato: string | null;
  status: GrowthLeadStatus;
  valor_potencial: number;
  vertical: GrowthVertical | null;
  observacoes: string | null;
  canal: GrowthLeadCanal;
  external_id: string | null;
  created_at: string;
  updated_at: string;
};

export type GrowthContentMemory = {
  id: string;
  user_id: string;
  action_id: string;
  nicho: string | null;
  resumo: string | null;
  created_at: string;
};

type TableDef<Row, Insert = Partial<Row>, Update = Partial<Row>> = {
  Row: Row;
  Insert: Insert;
  Update: Update;
  Relationships: [];
};

export type Database = {
  public: {
    Tables: {
      profiles: TableDef<Profile>;
      gastos: TableDef<
        Gasto,
        Omit<Gasto, "id" | "created_at" | "updated_at"> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        }
      >;
      eventos: TableDef<
        Evento,
        Omit<
          Evento,
          "id" | "created_at" | "updated_at" | "growth_lead_id" | "data_fim" | "local" | "descricao"
        > & {
          id?: string;
          descricao?: string | null;
          data_fim?: string | null;
          local?: string | null;
          growth_lead_id?: string | null;
          created_at?: string;
          updated_at?: string;
        }
      >;
      clientes: TableDef<
        Cliente,
        Omit<Cliente, "id" | "created_at" | "updated_at" | "instagram"> & {
          id?: string;
          instagram?: string | null;
          created_at?: string;
          updated_at?: string;
        }
      >;
      orcamentos: TableDef<
        Orcamento,
        Omit<
          Orcamento,
          "id" | "created_at" | "updated_at" | "data_evento" | "local" | "growth_lead_id"
        > & {
          id?: string;
          data_evento?: string | null;
          local?: string | null;
          growth_lead_id?: string | null;
          created_at?: string;
          updated_at?: string;
        }
      >;
      estoque: TableDef<
        EstoqueItem,
        Omit<EstoqueItem, "id" | "created_at" | "updated_at"> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        }
      >;
      treinos: TableDef<
        Treino,
        Omit<Treino, "id" | "created_at" | "updated_at"> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        }
      >;
      dieta: TableDef<
        DietaItem,
        Omit<DietaItem, "id" | "created_at" | "updated_at"> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        }
      >;
      conteudos: TableDef<
        Conteudo,
        Omit<
          Conteudo,
          "id" | "created_at" | "updated_at" | "formato" | "objetivo" | "observacoes" | "roteiro"
        > & {
          id?: string;
          formato?: string | null;
          objetivo?: string | null;
          observacoes?: string | null;
          roteiro?: string | null;
          created_at?: string;
          updated_at?: string;
        }
      >;
      leads: TableDef<
        Lead,
        Omit<Lead, "id" | "created_at" | "updated_at"> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        }
      >;
      ai_messages: TableDef<
        AiMessage,
        Omit<AiMessage, "id" | "created_at"> & {
          id?: string;
          created_at?: string;
        }
      >;
      growth_goals: TableDef<
        GrowthGoal,
        Omit<GrowthGoal, "id" | "created_at" | "updated_at"> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        }
      >;
      growth_missions: TableDef<
        GrowthMission,
        Omit<GrowthMission, "id" | "created_at" | "updated_at" | "completed_at"> & {
          id?: string;
          completed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        }
      >;
      growth_actions: TableDef<
        GrowthAction,
        Omit<GrowthAction, "id" | "created_at" | "updated_at"> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        }
      >;
      growth_profiles: TableDef<
        GrowthProfile,
        Omit<GrowthProfile, "id" | "created_at" | "updated_at"> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        }
      >;
      growth_analyses: TableDef<
        GrowthAnalysis,
        Omit<GrowthAnalysis, "id" | "created_at" | "updated_at"> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        }
      >;
      growth_leads: TableDef<
        GrowthLead,
        Omit<
          GrowthLead,
          "id" | "created_at" | "updated_at" | "contato" | "vertical" | "observacoes" | "external_id"
        > & {
          id?: string;
          contato?: string | null;
          vertical?: GrowthVertical | null;
          observacoes?: string | null;
          external_id?: string | null;
          created_at?: string;
          updated_at?: string;
        }
      >;
      growth_content_memory: TableDef<
        GrowthContentMemory,
        Omit<GrowthContentMemory, "id" | "created_at"> & {
          id?: string;
          nicho?: string | null;
          resumo?: string | null;
          created_at?: string;
        }
      >;
      alvesz_eventos: TableDef<
        AlveszEvento,
        Omit<
          AlveszEvento,
          "id" | "created_at" | "updated_at" | "evento_calendario_id" | "local" | "cliente_id"
        > & {
          id?: string;
          local?: string | null;
          cliente_id?: string | null;
          evento_calendario_id?: string | null;
          created_at?: string;
          updated_at?: string;
        }
      >;
    };
    Views: Record<string, never>;
    Functions: {
      seed_demo_data: { Args: Record<string, never>; Returns: undefined };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

export type TableName = keyof Database["public"]["Tables"];

export type TableRow<T extends TableName> =
  Database["public"]["Tables"][T]["Row"];

export type TableInsert<T extends TableName> =
  Database["public"]["Tables"][T]["Insert"];

export type TableUpdate<T extends TableName> =
  Database["public"]["Tables"][T]["Update"];

/** Tabelas com user_id para RLS */
export type UserScopedTable =
  | "gastos"
  | "eventos"
  | "clientes"
  | "orcamentos"
  | "estoque"
  | "treinos"
  | "dieta"
  | "conteudos"
  | "leads"
  | "ai_messages"
  | "growth_goals"
  | "growth_missions"
  | "growth_actions"
  | "growth_profiles"
  | "growth_analyses"
  | "growth_leads"
  | "growth_content_memory"
  | "alvesz_eventos";

export type AiModule =
  | "financeiro"
  | "calendario"
  | "alvesz"
  | "saude"
  | "social-media"
  | "consorcios"
  | "crescimento";
