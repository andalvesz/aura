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

export type FinancialIncomeOrigem =
  | "alvesz"
  | "consorcios"
  | "salario"
  | "freelance"
  | "outros";

export type FinancialGoal = {
  id: string;
  user_id: string;
  titulo: string;
  valor_meta: number;
  valor_atual: number;
  data_inicio: string;
  data_fim: string;
  created_at: string;
  updated_at: string;
};

export type FinancialIncome = {
  id: string;
  user_id: string;
  descricao: string;
  valor: number;
  origem: FinancialIncomeOrigem | string;
  data: string;
  orcamento_id: string | null;
  created_at: string;
  updated_at: string;
};

export type FinancialBalance = {
  id: string;
  user_id: string;
  valor_atual: number;
  created_at: string;
  updated_at: string;
};

export type GoalTipo =
  | "financeira"
  | "saude"
  | "conteudo"
  | "vendas"
  | "eventos"
  | "personalizada";

export type GoalStatus = "ativa" | "concluida" | "cancelada";

export type Goal = {
  id: string;
  user_id: string;
  titulo: string;
  tipo: GoalTipo;
  meta: number;
  atual: number;
  data_inicio: string;
  data_fim: string;
  status: GoalStatus;
  created_at: string;
};

export type GoogleSyncStatus = "synced" | "pending" | "error";

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
  google_event_id: string | null;
  google_sync_status: GoogleSyncStatus | null;
  created_at: string;
  updated_at: string;
};

export type GoogleCalendarConnection = {
  id: string;
  user_id: string;
  google_email: string | null;
  access_token: string | null;
  refresh_token: string | null;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
};

export type CommunicationChannel = "email" | "whatsapp" | "instagram";
export type CommunicationDirection = "outbound" | "inbound";
export type CommunicationStatus = "pending" | "sent" | "opened" | "failed";

export type CommunicationLog = {
  id: string;
  user_id: string;
  channel: CommunicationChannel;
  direction: CommunicationDirection;
  status: CommunicationStatus;
  subject: string | null;
  body_preview: string | null;
  recipient: string | null;
  cliente_id: string | null;
  orcamento_id: string | null;
  lead_id: string | null;
  proposta_id: string | null;
  gmail_message_id: string | null;
  gmail_thread_id: string | null;
  tracking_token: string | null;
  opened_at: string | null;
  metadata: Json;
  created_at: string;
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
  observacoes: string | null;
  growth_lead_id: string | null;
  created_at: string;
  updated_at: string;
};

export type AlveszProposta = {
  id: string;
  user_id: string;
  orcamento_id: string;
  conteudo: string;
  melhorada_ia: boolean;
  pdf_meta: Json;
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
  marca: InstagramMarca | null;
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

export type HealthHabit = {
  id: string;
  user_id: string;
  titulo: string;
  frequencia: string;
  status: string;
  data: string;
  created_at: string;
  updated_at: string;
};

export type HealthWorkout = {
  id: string;
  user_id: string;
  nome: string;
  grupo_muscular: string;
  exercicios: Json;
  duracao_min: number;
  observacoes: string | null;
  data: string;
  created_at: string;
  updated_at: string;
};

export type HealthMeal = {
  id: string;
  user_id: string;
  nome: string;
  horario: string;
  alimentos: string | null;
  calorias: number | null;
  observacoes: string | null;
  data: string;
  created_at: string;
  updated_at: string;
};

export type HealthSessionTipo = "leitura" | "meditacao";

export type HealthSession = {
  id: string;
  user_id: string;
  tipo: HealthSessionTipo;
  titulo: string;
  duracao_min: number;
  data: string;
  status: string;
  observacoes: string | null;
  created_at: string;
  updated_at: string;
};

export type TripStatus =
  | "planejando"
  | "confirmada"
  | "em_viagem"
  | "concluida"
  | "cancelada";

export type TripChecklistCategoria =
  | "documentos"
  | "passaporte"
  | "visto"
  | "ingressos"
  | "hospedagem"
  | "seguro"
  | "transporte";

export type TripChecklistStatus = "pendente" | "feito";

export type Trip = {
  id: string;
  user_id: string;
  nome: string;
  destino: string;
  data_ida: string;
  data_volta: string;
  orcamento: number;
  gasto_atual: number;
  status: TripStatus;
  template_id: string | null;
  created_at: string;
  updated_at: string;
};

export type TripChecklistItem = {
  id: string;
  user_id: string;
  trip_id: string;
  categoria: TripChecklistCategoria;
  titulo: string;
  status: TripChecklistStatus;
  ordem: number;
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

export type AiMemoryCategoria =
  | "coach"
  | "mentor"
  | "calendario"
  | "financeiro"
  | "saude"
  | "alvesz"
  | "crescimento"
  | "social_media";

export type AiMemory = {
  id: string;
  user_id: string;
  categoria: AiMemoryCategoria;
  titulo: string;
  conteudo: string;
  origem: string;
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

export type InstagramMarca = "marca_pessoal" | "alvesz" | "consorcios";

export type GrowthProfile = {
  id: string;
  user_id: string;
  plataforma: string;
  username: string;
  nicho: string | null;
  objetivo: string | null;
  observacoes: string | null;
  marca: InstagramMarca | null;
  bio: string | null;
  frequencia_conteudo: string | null;
  analise: Record<string, unknown> | null;
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

export type NotificationType =
  | "lead_followup"
  | "event_upcoming"
  | "event_tomorrow"
  | "mission_pending"
  | "content_overdue"
  | "workout_planned"
  | "budget_negotiation"
  | "budget_waiting"
  | "habit_pending"
  | "goal_behind"
  | "revenue_below_target"
  | "financial_goal_behind"
  | "financial_expense_spike"
  | "financial_goal_reached";

export type NotificationStatus = "unread" | "read";

export type Notification = {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: NotificationType;
  status: NotificationStatus;
  related_module: string | null;
  related_id: string | null;
  scheduled_for: string | null;
  created_at: string;
  read_at: string | null;
};

export type AuraCommandHistoryStatus = "success" | "error";

export type AuraCommandHistory = {
  id: string;
  user_id: string;
  command_id: string;
  module: string;
  summary: string;
  payload: Json;
  result: Json | null;
  status: AuraCommandHistoryStatus;
  error_message: string | null;
  created_at: string;
};

export type XpAcao =
  | "registrar_despesa"
  | "registrar_receita"
  | "criar_evento"
  | "concluir_evento"
  | "completar_habito"
  | "completar_treino"
  | "follow_up_realizado"
  | "lead_convertido"
  | "evento_fechado_alvesz"
  | "criar_viagem"
  | "completar_checklist_viagem";

export type UserXp = {
  id: string;
  user_id: string;
  xp_total: number;
  nivel: number;
  streak_dias: number;
  created_at: string;
};

export type XpHistory = {
  id: string;
  user_id: string;
  acao: string;
  xp: number;
  created_at: string;
};

export type SystemLogTipo = "error" | "warning" | "info" | "success";

export type SystemLog = {
  id: string;
  user_id: string;
  tipo: SystemLogTipo;
  modulo: string;
  mensagem: string;
  detalhes: Json | null;
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
      financial_goals: TableDef<
        FinancialGoal,
        Omit<FinancialGoal, "id" | "created_at" | "updated_at" | "valor_atual"> & {
          id?: string;
          valor_atual?: number;
          created_at?: string;
          updated_at?: string;
        }
      >;
      financial_income: TableDef<
        FinancialIncome,
        Omit<FinancialIncome, "id" | "created_at" | "updated_at" | "orcamento_id"> & {
          id?: string;
          orcamento_id?: string | null;
          created_at?: string;
          updated_at?: string;
        }
      >;
      financial_balance: TableDef<
        FinancialBalance,
        Omit<FinancialBalance, "id" | "created_at" | "updated_at"> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        }
      >;
      goals: TableDef<
        Goal,
        Omit<Goal, "id" | "created_at"> & {
          id?: string;
          created_at?: string;
        }
      >;
      eventos: TableDef<
        Evento,
        Omit<
          Evento,
          | "id"
          | "created_at"
          | "updated_at"
          | "growth_lead_id"
          | "data_fim"
          | "local"
          | "descricao"
          | "google_event_id"
          | "google_sync_status"
        > & {
          id?: string;
          descricao?: string | null;
          data_fim?: string | null;
          local?: string | null;
          growth_lead_id?: string | null;
          google_event_id?: string | null;
          google_sync_status?: GoogleSyncStatus | null;
          created_at?: string;
          updated_at?: string;
        }
      >;
      google_calendar_connections: TableDef<
        GoogleCalendarConnection,
        Omit<GoogleCalendarConnection, "id" | "created_at" | "updated_at"> & {
          id?: string;
          google_email?: string | null;
          access_token?: string | null;
          refresh_token?: string | null;
          expires_at?: string | null;
          created_at?: string;
          updated_at?: string;
        }
      >;
      communication_logs: TableDef<
        CommunicationLog,
        Omit<
          CommunicationLog,
          | "id"
          | "created_at"
          | "subject"
          | "body_preview"
          | "recipient"
          | "cliente_id"
          | "orcamento_id"
          | "lead_id"
          | "proposta_id"
          | "gmail_message_id"
          | "gmail_thread_id"
          | "tracking_token"
          | "opened_at"
          | "metadata"
        > & {
          id?: string;
          subject?: string | null;
          body_preview?: string | null;
          recipient?: string | null;
          cliente_id?: string | null;
          orcamento_id?: string | null;
          lead_id?: string | null;
          proposta_id?: string | null;
          gmail_message_id?: string | null;
          gmail_thread_id?: string | null;
          tracking_token?: string | null;
          opened_at?: string | null;
          metadata?: Json;
          created_at?: string;
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
          | "id"
          | "created_at"
          | "updated_at"
          | "data_evento"
          | "local"
          | "observacoes"
          | "growth_lead_id"
        > & {
          id?: string;
          data_evento?: string | null;
          local?: string | null;
          observacoes?: string | null;
          growth_lead_id?: string | null;
          created_at?: string;
          updated_at?: string;
        }
      >;
      alvesz_propostas: TableDef<
        AlveszProposta,
        Omit<
          AlveszProposta,
          "id" | "created_at" | "updated_at" | "melhorada_ia" | "pdf_meta"
        > & {
          id?: string;
          melhorada_ia?: boolean;
          pdf_meta?: Json;
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
          | "id"
          | "created_at"
          | "updated_at"
          | "formato"
          | "objetivo"
          | "observacoes"
          | "roteiro"
          | "marca"
        > & {
          id?: string;
          formato?: string | null;
          objetivo?: string | null;
          observacoes?: string | null;
          roteiro?: string | null;
          marca?: InstagramMarca | null;
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
      ai_memories: TableDef<
        AiMemory,
        Omit<AiMemory, "id" | "created_at"> & {
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
        Omit<
          GrowthProfile,
          | "id"
          | "created_at"
          | "updated_at"
          | "marca"
          | "bio"
          | "frequencia_conteudo"
          | "analise"
        > & {
          id?: string;
          marca?: InstagramMarca | null;
          bio?: string | null;
          frequencia_conteudo?: string | null;
          analise?: Record<string, unknown> | null;
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
      health_habits: TableDef<
        HealthHabit,
        Omit<HealthHabit, "id" | "created_at" | "updated_at"> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        }
      >;
      health_workouts: TableDef<
        HealthWorkout,
        Omit<
          HealthWorkout,
          "id" | "created_at" | "updated_at" | "observacoes" | "exercicios"
        > & {
          id?: string;
          observacoes?: string | null;
          exercicios?: Json;
          created_at?: string;
          updated_at?: string;
        }
      >;
      health_meals: TableDef<
        HealthMeal,
        Omit<
          HealthMeal,
          "id" | "created_at" | "updated_at" | "alimentos" | "calorias" | "observacoes"
        > & {
          id?: string;
          alimentos?: string | null;
          calorias?: number | null;
          observacoes?: string | null;
          created_at?: string;
          updated_at?: string;
        }
      >;
      health_sessions: TableDef<
        HealthSession,
        Omit<HealthSession, "id" | "created_at" | "updated_at" | "observacoes"> & {
          id?: string;
          observacoes?: string | null;
          created_at?: string;
          updated_at?: string;
        }
      >;
      trips: TableDef<
        Trip,
        Omit<
          Trip,
          "id" | "created_at" | "updated_at" | "template_id" | "gasto_atual" | "status"
        > & {
          id?: string;
          gasto_atual?: number;
          status?: TripStatus;
          template_id?: string | null;
          created_at?: string;
          updated_at?: string;
        }
      >;
      trip_checklist_items: TableDef<
        TripChecklistItem,
        Omit<
          TripChecklistItem,
          "id" | "created_at" | "updated_at" | "status" | "ordem"
        > & {
          id?: string;
          status?: TripChecklistStatus;
          ordem?: number;
          created_at?: string;
          updated_at?: string;
        }
      >;
      notifications: TableDef<
        Notification,
        Omit<
          Notification,
          "id" | "created_at" | "status" | "read_at" | "related_module" | "related_id" | "scheduled_for"
        > & {
          id?: string;
          status?: NotificationStatus;
          related_module?: string | null;
          related_id?: string | null;
          scheduled_for?: string | null;
          read_at?: string | null;
          created_at?: string;
        }
      >;
      aura_command_history: TableDef<
        AuraCommandHistory,
        Omit<AuraCommandHistory, "id" | "created_at"> & {
          id?: string;
          result?: Json | null;
          error_message?: string | null;
          created_at?: string;
        }
      >;
      user_xp: TableDef<
        UserXp,
        Omit<UserXp, "id" | "created_at"> & {
          id?: string;
          created_at?: string;
        }
      >;
      xp_history: TableDef<
        XpHistory,
        Omit<XpHistory, "id" | "created_at"> & {
          id?: string;
          created_at?: string;
        }
      >;
      system_logs: TableDef<
        SystemLog,
        Omit<SystemLog, "id" | "created_at" | "detalhes"> & {
          id?: string;
          detalhes?: Json | null;
          created_at?: string;
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
  | "goals"
  | "financial_goals"
  | "financial_income"
  | "financial_balance"
  | "eventos"
  | "clientes"
  | "orcamentos"
  | "alvesz_propostas"
  | "estoque"
  | "treinos"
  | "dieta"
  | "conteudos"
  | "leads"
  | "ai_messages"
  | "ai_memories"
  | "growth_goals"
  | "growth_missions"
  | "growth_actions"
  | "growth_profiles"
  | "growth_analyses"
  | "growth_leads"
  | "growth_content_memory"
  | "alvesz_eventos"
  | "health_habits"
  | "health_workouts"
  | "health_meals"
  | "health_sessions"
  | "trips"
  | "trip_checklist_items"
  | "notifications"
  | "aura_command_history"
  | "communication_logs"
  | "user_xp"
  | "xp_history"
  | "system_logs";

export type AiModule =
  | "aura_central"
  | "mentor"
  | "agenda"
  | "saude"
  | "social";
