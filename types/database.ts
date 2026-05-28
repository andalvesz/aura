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
  created_at: string;
  updated_at: string;
};

export type Cliente = {
  id: string;
  user_id: string;
  nome: string;
  telefone: string | null;
  email: string | null;
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
        Omit<Evento, "id" | "created_at" | "updated_at"> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        }
      >;
      clientes: TableDef<
        Cliente,
        Omit<Cliente, "id" | "created_at" | "updated_at"> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        }
      >;
      orcamentos: TableDef<
        Orcamento,
        Omit<Orcamento, "id" | "created_at" | "updated_at"> & {
          id?: string;
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
        Omit<Conteudo, "id" | "created_at" | "updated_at"> & {
          id?: string;
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
  | "ai_messages";

export type AiModule =
  | "financeiro"
  | "calendario"
  | "alvesz"
  | "saude"
  | "social-media"
  | "consorcios";
