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
  sync_token: string | null;
  granted_scopes: string | null;
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
  data_publicada_em: string | null;
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

export type LanguageModo =
  | "viagens"
  | "aeroporto"
  | "hotel"
  | "disney"
  | "nba"
  | "negocios"
  | "conversacao_livre";

export type LanguageSessionTipo =
  | "aula_diaria"
  | "vocabulario"
  | "frases"
  | "exercicio"
  | "correcao"
  | "conversacao";

export type LanguageSessionStatus =
  | "planejado"
  | "em_andamento"
  | "concluido"
  | "cancelado";

export type LanguageLessonStatus = "pendente" | "em_andamento" | "concluido";

export type LanguageNivel = "iniciante" | "intermediario" | "avancado";

export type LanguageProgress = {
  id: string;
  user_id: string;
  modo_favorito: LanguageModo | null;
  nivel: LanguageNivel;
  streak_dias: number;
  ultima_pratica: string | null;
  aulas_concluidas: number;
  exercicios_concluidos: number;
  modulos_concluidos: number;
  meta_diaria_min: number;
  created_at: string;
  updated_at: string;
};

export type LanguageSession = {
  id: string;
  user_id: string;
  modo: LanguageModo;
  tipo: LanguageSessionTipo;
  titulo: string;
  duracao_min: number;
  data: string;
  status: LanguageSessionStatus;
  conteudo: Json;
  score: number | null;
  feedback: string | null;
  created_at: string;
  updated_at: string;
};

export type LanguageLesson = {
  id: string;
  user_id: string;
  session_id: string | null;
  modo: LanguageModo;
  titulo: string;
  vocabulario: Json;
  frases: Json;
  exercicios: Json;
  status: LanguageLessonStatus;
  ordem: number;
  score: number | null;
  concluido_em: string | null;
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

export type LegacyCategoria =
  | "ginastica"
  | "danca"
  | "teatro"
  | "empreendedorismo"
  | "tecnologia"
  | "viagens"
  | "vida_pessoal";

export type LegacyAchievementTipo =
  | "medalha"
  | "trofeu"
  | "vaga"
  | "conquista_pessoal"
  | "outro";

export type LegacyLifeEventTipo =
  | "competicao"
  | "apresentacao"
  | "conquista"
  | "viagem"
  | "pessoal"
  | "profissional"
  | "outro";

export type LegacyMilestoneTipo =
  | "inicio_ginastica"
  | "inicio_danca"
  | "inicio_teatro"
  | "primeiro_cliente_alvesz"
  | "criacao_aura"
  | "noivado"
  | "viagem_internacional"
  | "conquista_futura"
  | "outro";

export type LegacyMilestoneStatus = "concluido" | "em_andamento" | "futuro";

export type LegacyTimeline = {
  id: string;
  user_id: string;
  titulo: string;
  descricao: string | null;
  categoria: LegacyCategoria;
  ano: number;
  mes: number | null;
  ordem: number;
  created_at: string;
  updated_at: string;
};

export type LegacyAchievement = {
  id: string;
  user_id: string;
  titulo: string;
  descricao: string | null;
  tipo: LegacyAchievementTipo;
  categoria: LegacyCategoria;
  ano: number;
  local: string | null;
  ordem: number;
  created_at: string;
  updated_at: string;
};

export type LegacyCertificate = {
  id: string;
  user_id: string;
  titulo: string;
  instituicao: string | null;
  categoria: LegacyCategoria;
  ano: number;
  descricao: string | null;
  ordem: number;
  created_at: string;
  updated_at: string;
};

export type LegacyLifeEvent = {
  id: string;
  user_id: string;
  titulo: string;
  descricao: string | null;
  categoria: LegacyCategoria;
  data_evento: string;
  tipo_evento: LegacyLifeEventTipo;
  ordem: number;
  created_at: string;
  updated_at: string;
};

export type LegacyMilestone = {
  id: string;
  user_id: string;
  titulo: string;
  descricao: string | null;
  categoria: LegacyCategoria;
  data_marco: string | null;
  tipo_marco: LegacyMilestoneTipo;
  status: LegacyMilestoneStatus;
  ordem: number;
  created_at: string;
  updated_at: string;
};

export type CreatorProductStatus =
  | "ideia"
  | "pesquisa"
  | "validacao"
  | "producao"
  | "pagina_vendas"
  | "criativos"
  | "lancamento"
  | "trafego"
  | "escala";

export type CreatorPipelineStage = CreatorProductStatus;

export type CreatorProduct = {
  id: string;
  user_id: string;
  status: CreatorProductStatus;
  nicho: string | null;
  conhecimento: string | null;
  publico_alvo_input: string | null;
  objetivo_financeiro: number | null;
  prazo: string | null;
  target_country: string | null;
  target_language: string | null;
  currency: string | null;
  used_aura_data: boolean;
  nome: string | null;
  problema: string | null;
  solucao: string | null;
  avatar: string | null;
  publico_alvo: string | null;
  promessa: string | null;
  mecanismo_unico: string | null;
  diferenciais: string | null;
  faixa_preco_min: number | null;
  faixa_preco_max: number | null;
  formato: string | null;
  probabilidade_venda: number | null;
  investimento_previsto: number | null;
  receita_prevista: number | null;
  roi_estimado: number | null;
  created_at: string;
  updated_at: string;
};

export type CreatorValidation = {
  id: string;
  user_id: string;
  product_id: string;
  demanda: number;
  concorrencia: number;
  facilidade_criacao: number;
  facilidade_venda: number;
  escalabilidade: number;
  viabilidade: number | null;
  lucro_potencial: number | null;
  tempo_lancar: number | null;
  compatibilidade_perfil: number | null;
  nota_final: number;
  created_at: string;
  updated_at: string;
};

export type CreatorChecklistStatus = "pendente" | "feito";

export type CreatorChecklistItem = {
  id: string;
  user_id: string;
  product_id: string;
  estagio: CreatorPipelineStage;
  titulo: string;
  status: CreatorChecklistStatus;
  ordem: number;
  created_at: string;
  updated_at: string;
};

export type CreatorOffer = {
  id: string;
  user_id: string;
  product_id: string;
  headline: string | null;
  subheadline: string | null;
  bullet_points: Json;
  garantia: string | null;
  bonus: string | null;
  cta: string | null;
  created_at: string;
  updated_at: string;
};

export type CreatorLaunchStatus = "planned" | "active" | "completed" | "paused";

export type CreatorLaunch = {
  id: string;
  user_id: string;
  product_id: string;
  status: CreatorLaunchStatus;
  potencial_estimado: number | null;
  launched_at: string | null;
  notes: string | null;
  target_country: string | null;
  target_language: string | null;
  currency: string | null;
  created_at: string;
  updated_at: string;
};

export type CreatorResearch = {
  id: string;
  user_id: string;
  ideia_input: string | null;
  nicho: string | null;
  target_country: string | null;
  target_language: string | null;
  currency: string | null;
  publico: string | null;
  problema: string | null;
  solucao: string | null;
  concorrencia_analise: string | null;
  facilidade_criacao: number | null;
  facilidade_venda: number | null;
  demanda: number | null;
  competicao: number | null;
  escalabilidade: number | null;
  potencial_lucro: number | null;
  compatibilidade_perfil: number | null;
  nota_final: number | null;
  avatar: string | null;
  dores: Json;
  desejos: Json;
  objecoes: Json;
  produtos_concorrentes: Json;
  diferencial_sugerido: string | null;
  faixa_preco_min: number | null;
  faixa_preco_max: number | null;
  product_id: string | null;
  created_at: string;
  updated_at: string;
};

export type CreatorLaunchPlan = {
  id: string;
  user_id: string;
  product_id: string;
  titulo: string | null;
  estagio_atual: string | null;
  score_ia: number | null;
  receita_estimada: number | null;
  data_prevista_lancamento: string | null;
  orcamento_disponivel: number | null;
  tarefas: Json;
  cronograma: Json;
  prioridades: Json;
  created_at: string;
  updated_at: string;
};

export type MoneyMissionPlanStatus = "active" | "completed" | "archived";
export type MoneyMissionPrazo = "30_dias" | "90_dias" | "6_meses" | "1_ano";
export type MoneyMissionPrioridade = "seguranca" | "crescimento" | "escala";
export type MoneyMissionTaskStatus = "pending" | "completed";
export type MoneyMissionTaskTipo = "semanal" | "diaria";

export type MoneyMissionPlan = {
  id: string;
  user_id: string;
  valor_meta: number;
  valor_conquistado: number;
  currency: string | null;
  prazo: MoneyMissionPrazo;
  prioridade: MoneyMissionPrioridade;
  data_inicio: string;
  data_fim: string;
  status: MoneyMissionPlanStatus;
  plano_financeiro: string | null;
  produtos_recomendados: Json;
  servicos_recomendados: Json;
  receita_estimada: number | null;
  investimento_necessario: number | null;
  roi_estimado: number | null;
  riscos: Json;
  probabilidade_sucesso: number | null;
  cronograma: Json;
  orcamento_disponivel: number | null;
  created_at: string;
  updated_at: string;
};

export type MoneyMissionTask = {
  id: string;
  user_id: string;
  plan_id: string;
  mission_key: string;
  titulo: string;
  descricao: string;
  semana: number | null;
  ordem: number;
  tipo: MoneyMissionTaskTipo;
  status: MoneyMissionTaskStatus;
  mission_date: string | null;
  completed_at: string | null;
  xp_reward: number;
  created_at: string;
  updated_at: string;
};

export type AuraCeoSessionStatus = "active" | "archived";

export type AuraCeoSession = {
  id: string;
  user_id: string;
  pergunta: string;
  resumo_executivo: string | null;
  prioridades: Json;
  riscos: Json;
  oportunidades: Json;
  plano_acao: string | null;
  cronograma: Json;
  missoes_recomendadas: Json;
  probabilidade_sucesso: number | null;
  opportunity_radar: Json;
  score_ia: number | null;
  status: AuraCeoSessionStatus;
  created_at: string;
  updated_at: string;
};

export type GrowthBrainMemoryStatus = "active" | "archived" | "learning";

export type GrowthBrainMemory = {
  id: string;
  user_id: string;
  operation_id: string | null;
  product_id: string | null;
  copy_id: string | null;
  creative_id: string | null;
  landing_id: string | null;
  campaign_id: string | null;
  source_platform: string | null;
  country: string | null;
  language: string | null;
  ctr: number | null;
  cpc: number | null;
  cpa: number | null;
  roas: number | null;
  revenue: number | null;
  spend: number | null;
  conversion_rate: number | null;
  status: GrowthBrainMemoryStatus;
  lesson: string | null;
  recommendation: string | null;
  metadata: Json;
  created_at: string;
};

export type GrowthPatternType =
  | "copy"
  | "creative"
  | "landing"
  | "campaign"
  | "niche"
  | "country"
  | "language"
  | "revenue"
  | "performance";

export type GrowthPattern = {
  id: string;
  user_id: string;
  niche: string | null;
  country: string | null;
  language: string | null;
  pattern_type: GrowthPatternType;
  score: number;
  lesson: string | null;
  recommendation: string | null;
  created_at: string;
};

export type RevenueForecastType = "revenue" | "profit" | "growth" | "scale";

export type RevenueForecastPeriod = "weekly" | "monthly" | "quarterly";

export type RevenueMetricType = "estimated" | "real";

export type RevenueMetric = {
  id: string;
  user_id: string;
  operation_id: string | null;
  product_id: string | null;
  platform: string | null;
  country: string | null;
  currency: string;
  revenue: number;
  spend: number;
  profit: number;
  roas: number | null;
  roi: number | null;
  conversions: number;
  clicks: number;
  ctr: number | null;
  cpc: number | null;
  cpa: number | null;
  date: string;
  metric_type: RevenueMetricType;
  metadata: Json;
  created_at: string;
};

export type RevenueForecast = {
  id: string;
  user_id: string;
  forecast_type: RevenueForecastType;
  period: RevenueForecastPeriod;
  predicted_revenue: number;
  predicted_profit: number;
  confidence: number;
  recommendation: string | null;
  metadata: Json;
  created_at: string;
};

export type MarketWatchlistStatus = "watching" | "active" | "launched" | "archived";

export type MarketOpportunity = {
  id: string;
  user_id: string;
  source_platform: string | null;
  product_name: string;
  niche: string | null;
  country: string | null;
  language: string | null;
  currency: string;
  estimated_demand: number | null;
  estimated_competition: number | null;
  estimated_conversion: number | null;
  opportunity_score: number;
  recommendation: string | null;
  metadata: Json;
  created_at: string;
};

export type MarketWatchlist = {
  id: string;
  user_id: string;
  product_name: string;
  source_platform: string | null;
  score: number | null;
  status: MarketWatchlistStatus;
  notes: string | null;
  created_at: string;
};

export type OperationCenterStatus =
  | "draft"
  | "preparing"
  | "ready"
  | "approved"
  | "cancelled";

export type OperationCenter = {
  id: string;
  user_id: string;
  status: OperationCenterStatus;
  titulo: string;
  product_id: string | null;
  product_nome: string | null;
  ceo_session_id: string | null;
  smart_launch_session_id: string | null;
  copylab_id: string | null;
  assets_id: string | null;
  landing_id: string | null;
  orchestration_id: string | null;
  performance_report_id: string | null;
  steps: Json;
  operational_score: number;
  success_chance: number | null;
  roi_previsto: number | null;
  next_steps: Json;
  executive_logs: Json;
  metadata: Json;
  created_at: string;
  updated_at: string;
};

export type CreatorCopylab = {
  id: string;
  user_id: string;
  product_id: string | null;
  nome: string | null;
  avatar: string | null;
  problema: string | null;
  solucao: string | null;
  promessa: string | null;
  diferencial: string | null;
  preco: number | null;
  headline: string | null;
  subheadline: string | null;
  big_idea: string | null;
  mecanismo_unico: string | null;
  bullets: Json;
  garantia: string | null;
  bonus: string | null;
  cta: string | null;
  pagina_vendas: string | null;
  estrutura_vsl: string | null;
  storytelling: string | null;
  email_lancamento: string | null;
  whatsapp_venda: string | null;
  instagram_post: string | null;
  facebook_ad: string | null;
  google_ad: string | null;
  created_at: string;
  updated_at: string;
};

export type ProductFactoryStatus =
  | "draft"
  | "content_ready"
  | "design_ready"
  | "pdf_ready"
  | "published";

export type ProductFactoryType =
  | "ebook"
  | "checklist"
  | "workbook"
  | "guia_pratico"
  | "plano_7_dias"
  | "plano_30_dias"
  | "mini_curso";

export type ProductVersionLabel = "rascunho" | "revisado" | "final";

export type ProductFileType = "pdf" | "cover" | "asset";

export type ProductComplianceStatus = "pass" | "warning" | "fail";

export type ProductComplianceRiskLevel = "low" | "medium" | "high";

export type CreativeAssetType =
  | "image"
  | "carousel"
  | "banner"
  | "thumbnail"
  | "vsl_script"
  | "reel_script"
  | "ugc_script"
  | "headline_variations"
  | "cta_variations";

export type CreativeAssetStatus = "generating" | "ready" | "failed";

export type LandingPageStatus = "draft" | "preview" | "published";

export type LandingPage = {
  id: string;
  user_id: string;
  operation_id: string | null;
  product_id: string | null;
  title: string | null;
  slug: string;
  headline: string | null;
  subheadline: string | null;
  hero_copy: string | null;
  benefits_json: Json;
  proof_json: Json;
  offer_json: Json;
  faq_json: Json;
  cta_text: string | null;
  html: string | null;
  status: LandingPageStatus;
  preview_url: string | null;
  published_url: string | null;
  metadata: Json;
  created_at: string;
  updated_at: string;
};

export type FunnelStatus = "draft" | "generating" | "ready" | "active" | "archived";

export type FunnelType = "standard" | "tripwire" | "webinar" | "high_ticket";

export type FunnelStepType =
  | "front_end"
  | "order_bump"
  | "upsell_1"
  | "upsell_2"
  | "downsell"
  | "thank_you";

export type FunnelStepStatus = "suggested" | "ready" | "active" | "skipped";

export type Funnel = {
  id: string;
  user_id: string;
  operation_id: string | null;
  product_id: string | null;
  funnel_name: string;
  niche: string | null;
  status: FunnelStatus;
  funnel_type: FunnelType;
  total_steps: number;
  expected_aov: number | null;
  expected_conversion: number | null;
  metadata: Json;
  created_at: string;
  updated_at: string;
};

export type FunnelStep = {
  id: string;
  funnel_id: string;
  step_order: number;
  step_type: FunnelStepType;
  product_id: string | null;
  landing_id: string | null;
  copy_id: string | null;
  creative_id: string | null;
  offer_id: string | null;
  status: FunnelStepStatus;
  metadata: Json;
  created_at: string;
};

export type OfferType =
  | "front_end"
  | "order_bump"
  | "upsell"
  | "downsell"
  | "vip_offer"
  | "continuity";

export type OfferStatus = "draft" | "suggested" | "ready" | "active" | "archived";

export type Offer = {
  id: string;
  user_id: string;
  funnel_id: string | null;
  product_id: string | null;
  offer_type: OfferType;
  title: string;
  description: string | null;
  price: number;
  currency: string;
  expected_take_rate: number | null;
  expected_revenue: number | null;
  status: OfferStatus;
  metadata: Json;
  created_at: string;
  updated_at: string;
};

export type CreativeAsset = {
  id: string;
  user_id: string;
  operation_id: string | null;
  product_id: string | null;
  asset_type: CreativeAssetType;
  title: string | null;
  prompt: string | null;
  copy: string | null;
  format: string | null;
  status: CreativeAssetStatus;
  file_url: string | null;
  storage_path: string | null;
  thumbnail_url: string | null;
  metadata: Json;
  created_at: string;
  updated_at: string;
};

export type AdPlatform = "meta" | "google" | "tiktok" | "other";

export type AdCampaignStatus = "draft" | "pending_approval" | "ready_to_publish" | "cancelled";

export type AdSetStatus = "draft" | "ready";

export type AdCreativeStatus = "draft" | "ready";

export type AdCampaign = {
  id: string;
  user_id: string;
  operation_id: string | null;
  platform: AdPlatform;
  campaign_name: string;
  objective: string | null;
  budget: number | null;
  country: string | null;
  language: string | null;
  audience: Json;
  creatives_json: Json;
  copy_json: Json;
  landing_id: string | null;
  status: AdCampaignStatus;
  approval_required: boolean;
  metadata: Json;
  created_at: string;
  updated_at: string;
};

export type AdSet = {
  id: string;
  campaign_id: string;
  audience: Json;
  placements: Json;
  budget: number | null;
  status: AdSetStatus;
  metadata: Json;
  created_at: string;
};

export type AdCreative = {
  id: string;
  campaign_id: string;
  creative_asset_id: string | null;
  headline: string | null;
  primary_text: string | null;
  description: string | null;
  cta: string | null;
  status: AdCreativeStatus;
  metadata: Json;
  created_at: string;
};

export type ProductFactory = {
  id: string;
  user_id: string;
  product_id: string | null;
  copylab_id: string | null;
  research_id: string | null;
  product_type: ProductFactoryType;
  titulo: string | null;
  subtitulo: string | null;
  promessa: string | null;
  avatar: string | null;
  publico: string | null;
  objetivo: string | null;
  problema: string | null;
  solucao: string | null;
  capitulos: Json;
  conteudo: Json;
  exercicios: Json;
  bonus: string | null;
  checklist: Json;
  conclusao: string | null;
  design: Json;
  status: ProductFactoryStatus;
  current_version: number;
  created_at: string;
  updated_at: string;
};

export type ProductFile = {
  id: string;
  user_id: string;
  factory_id: string;
  file_type: ProductFileType;
  storage_path: string;
  file_url: string | null;
  file_name: string | null;
  mime_type: string;
  size_bytes: number | null;
  version_number: number;
  created_at: string;
};

export type ProductVersion = {
  id: string;
  user_id: string;
  factory_id: string;
  version_number: number;
  version_label: ProductVersionLabel | null;
  snapshot: Json;
  changelog: string | null;
  file_id: string | null;
  created_at: string;
};

export type ProductComplianceCheck = {
  id: string;
  user_id: string;
  factory_id: string;
  risk_score: number | null;
  risk_level: ProductComplianceRiskLevel | null;
  forbidden_claims: Json;
  misleading_risks: Json;
  ad_checklist: Json;
  recommendations: Json;
  status: ProductComplianceStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type PlatformId =
  | "kiwify"
  | "hotmart"
  | "eduzz"
  | "monetizze"
  | "meta_business"
  | "google_ads"
  | "tiktok_ads"
  | "stripe"
  | "paypal";

export type PlatformAuthType = "api_key" | "token" | "oauth";

export type PlatformConnectionStatus = "connected" | "disconnected" | "error";

export type PlatformSyncStatus = "pending" | "running" | "success" | "error";

export type PlatformSyncType =
  | "full"
  | "products"
  | "sales"
  | "commissions"
  | "affiliates"
  | "metrics";

export type AffiliateAnalysisType =
  | "affiliate_score"
  | "product_ranking"
  | "import_summary";

export type PlatformConnection = {
  id: string;
  user_id: string;
  platform: PlatformId;
  auth_type: PlatformAuthType;
  status: PlatformConnectionStatus;
  account_label: string | null;
  external_account_id: string | null;
  credentials_encrypted: string;
  metadata: Json;
  last_sync_at: string | null;
  last_error: string | null;
  created_at: string;
  updated_at: string;
};

export type PlatformSyncLog = {
  id: string;
  user_id: string;
  connection_id: string;
  platform: string;
  sync_type: PlatformSyncType;
  status: PlatformSyncStatus;
  records_synced: number;
  payload_summary: Json;
  error_message: string | null;
  created_at: string;
};

export type AffiliateProduct = {
  id: string;
  user_id: string;
  connection_id: string | null;
  platform: string;
  external_product_id: string;
  name: string;
  price_cents: number | null;
  commission_cents: number | null;
  commission_pct: number | null;
  currency: string;
  status: string;
  affiliate_enabled: boolean;
  metadata: Json;
  last_synced_at: string | null;
  created_at: string;
  updated_at: string;
};

export type AffiliateAnalysis = {
  id: string;
  user_id: string;
  platform: string | null;
  affiliate_product_id: string | null;
  analysis_type: AffiliateAnalysisType;
  ai_score: number | null;
  ticket_medio: number | null;
  potencial_venda: number | null;
  concorrencia: string | null;
  legado_compat: string | null;
  summary: string | null;
  insights: Json;
  raw_input: Json;
  created_at: string;
  updated_at: string;
};

export type KnowledgeEntryType =
  | "campaign"
  | "product"
  | "copy"
  | "audience"
  | "market"
  | "success"
  | "failure";

export type KnowledgeEntryCategory = "winner" | "loser" | "neutral";

export type KnowledgeConnector =
  | "platform_hub"
  | "meta_business"
  | "kiwify"
  | "hotmart"
  | "eduzz"
  | "monetizze"
  | "google_analytics"
  | "google_ads"
  | "stripe"
  | "paypal"
  | "global"
  | "creator"
  | "manual";

export type KnowledgeEntryStatus = "active" | "archived";

export type KnowledgeInsightType =
  | "opportunity"
  | "risk"
  | "trend"
  | "emerging_market";

export type KnowledgeInsightPriority = "low" | "medium" | "high";

export type KnowledgeInsightStatus = "active" | "dismissed" | "archived";

export type KnowledgePatternType =
  | "what_worked"
  | "what_failed"
  | "best_country"
  | "best_currency"
  | "best_campaign"
  | "best_market";

export type KnowledgeCurrency = "BRL" | "USD" | "EUR" | "GBP" | "CAD";

export type KnowledgeEntry = {
  id: string;
  user_id: string;
  entry_type: KnowledgeEntryType;
  category: KnowledgeEntryCategory;
  connector: KnowledgeConnector;
  title: string;
  description: string | null;
  country: string | null;
  currency: KnowledgeCurrency | null;
  performance_score: number | null;
  metrics: Json;
  source_ref: string | null;
  status: KnowledgeEntryStatus;
  metadata: Json;
  created_at: string;
  updated_at: string;
};

export type KnowledgeInsight = {
  id: string;
  user_id: string;
  insight_type: KnowledgeInsightType;
  title: string;
  summary: string;
  priority: KnowledgeInsightPriority;
  status: KnowledgeInsightStatus;
  related_entry_ids: Json;
  metadata: Json;
  created_at: string;
  updated_at: string;
};

export type KnowledgePattern = {
  id: string;
  user_id: string;
  pattern_type: KnowledgePatternType;
  label: string;
  description: string | null;
  country: string | null;
  currency: KnowledgeCurrency | null;
  confidence_score: number;
  evidence_count: number;
  metrics: Json;
  metadata: Json;
  created_at: string;
  updated_at: string;
};

export type MarketHistory = {
  id: string;
  user_id: string;
  country: string;
  currency: KnowledgeCurrency;
  market_label: string | null;
  period_start: string | null;
  period_end: string | null;
  sales_amount: number;
  sales_count: number;
  roas: number | null;
  ctr: number | null;
  conversion_rate: number | null;
  connector: KnowledgeConnector;
  metadata: Json;
  created_at: string;
  updated_at: string;
};

export type GlobalMarketStatus = "active" | "paused" | "archived";

export type GlobalProductType =
  | "curso"
  | "ebook"
  | "mentoria"
  | "software"
  | "afiliado"
  | "servico"
  | "outro";

export type GlobalObjective = "proprio" | "afiliado";

export type GlobalCurrency = "BRL" | "USD" | "EUR" | "GBP" | "CAD";

export type GlobalDifficulty = "baixa" | "media" | "alta";

export type GlobalProfitPotential = "baixo" | "medio" | "alto";

export type GlobalStrategyStatus = "draft" | "active" | "archived";

export type GlobalResultSource =
  | "manual"
  | "platform_hub"
  | "creator"
  | "money_missions";

export type GlobalMarket = {
  id: string;
  user_id: string;
  country: string;
  language: string;
  currency: GlobalCurrency;
  product_type: GlobalProductType;
  objective: GlobalObjective;
  product_name: string | null;
  creator_product_id: string | null;
  status: GlobalMarketStatus;
  global_score: number | null;
  score_financial: number | null;
  score_competition: number | null;
  score_entry_ease: number | null;
  score_skills_alignment: number | null;
  metadata: Json;
  created_at: string;
  updated_at: string;
};

export type GlobalStrategy = {
  id: string;
  user_id: string;
  market_id: string;
  suggested_price: number | null;
  currency: GlobalCurrency;
  audience: string | null;
  channels: Json;
  difficulty: GlobalDifficulty;
  profit_potential: GlobalProfitPotential;
  profit_potential_score: number | null;
  ai_summary: string | null;
  raw_analysis: Json;
  status: GlobalStrategyStatus;
  created_at: string;
  updated_at: string;
};

export type GlobalResult = {
  id: string;
  user_id: string;
  market_id: string | null;
  strategy_id: string | null;
  currency: GlobalCurrency;
  revenue_amount: number;
  revenue_converted_brl: number;
  product_name: string | null;
  period_start: string | null;
  period_end: string | null;
  source: GlobalResultSource;
  metadata: Json;
  created_at: string;
  updated_at: string;
};

export type CreatorAsset = {
  id: string;
  user_id: string;
  product_id: string | null;
  copylab_id: string | null;
  nome: string | null;
  avatar: string | null;
  problema: string | null;
  solucao: string | null;
  promessa: string | null;
  diferencial: string | null;
  preco: number | null;
  criativo_facebook: string | null;
  criativo_instagram: string | null;
  capa_ebook: string | null;
  thumbnail_youtube: string | null;
  mockup_produto: string | null;
  roteiro_reels: string | null;
  roteiro_shorts: string | null;
  roteiro_tiktok: string | null;
  vsl: string | null;
  carrossel_instagram: Json;
  stories: Json;
  legendas: string | null;
  cta: string | null;
  created_at: string;
  updated_at: string;
};

export type LandingModelo =
  | "pagina_simples"
  | "pagina_longa"
  | "captura_leads"
  | "webinar"
  | "produto_digital";

export type CreatorLanding = {
  id: string;
  user_id: string;
  product_id: string | null;
  copylab_id: string | null;
  target_country: string | null;
  target_language: string | null;
  currency: string | null;
  modelo: LandingModelo;
  nome: string | null;
  avatar: string | null;
  problema: string | null;
  solucao: string | null;
  promessa: string | null;
  diferencial: string | null;
  preco: number | null;
  hero_section: string | null;
  headline: string | null;
  subheadline: string | null;
  beneficios: Json;
  section_problema: string | null;
  section_solucao: string | null;
  depoimentos: Json;
  garantia: string | null;
  bonus: string | null;
  faq: Json;
  cta: string | null;
  rodape: string | null;
  created_at: string;
  updated_at: string;
};

export type AdsCampaignStatus = "draft" | "active" | "paused";

export type AutopilotControlLevel =
  | "manual"
  | "suggest"
  | "prepare"
  | "execute_approved";

export type AutopilotMonitorStatus = "active" | "paused";

export type AutopilotActionType =
  | "start_campaign"
  | "pause_campaign"
  | "resume_campaign"
  | "duplicate_campaign"
  | "generate_creative"
  | "generate_copy"
  | "suggest_scale"
  | "alert_budget"
  | "alert_ctr"
  | "alert_cpa"
  | "alert_frequency"
  | "increase_budget"
  | "publish_campaign";

export type AutopilotTriggerType = "manual" | "rule" | "ai";

export type AutopilotActionStatus =
  | "suggested"
  | "pending_approval"
  | "approved"
  | "rejected"
  | "executed"
  | "auto_executed";

export type AutopilotSettings = {
  user_id: string;
  control_level: AutopilotControlLevel;
  rules: Json;
  created_at: string;
  updated_at: string;
};

export type AutopilotLogEventType =
  | "manual_action"
  | "rule_triggered"
  | "action_approved"
  | "action_rejected"
  | "action_executed"
  | "settings_updated"
  | "bad_ad_detected"
  | "opportunity_found";

export type AutopilotLog = {
  id: string;
  user_id: string;
  campaign_id: string | null;
  action_id: string | null;
  event_type: AutopilotLogEventType;
  message: string;
  details: Json;
  created_at: string;
};

export type AutopilotMonitor = {
  id: string;
  user_id: string;
  campaign_id: string;
  monitor_status: AutopilotMonitorStatus;
  metrics: Json;
  last_evaluated_at: string | null;
  created_at: string;
  updated_at: string;
};

export type AutopilotAction = {
  id: string;
  user_id: string;
  campaign_id: string | null;
  action_type: AutopilotActionType;
  trigger_type: AutopilotTriggerType;
  rule_key: string | null;
  status: AutopilotActionStatus;
  requires_approval: boolean;
  metric_detected: string | null;
  metric_value: number | null;
  reason: string | null;
  suggestion: string | null;
  payload: Json;
  executed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type AdsObjetivo = "conversao" | "leads" | "trafego" | "engajamento";

export type AdsOrcamentoNivel = "baixo" | "medio" | "escala";

export type CreatorAdsCampaign = {
  id: string;
  user_id: string;
  product_id: string | null;
  asset_id: string | null;
  landing_id: string | null;
  copylab_id: string | null;
  target_country: string | null;
  target_language: string | null;
  currency: string | null;
  status: AdsCampaignStatus;
  nome: string | null;
  avatar: string | null;
  problema: string | null;
  solucao: string | null;
  promessa: string | null;
  diferencial: string | null;
  preco: number | null;
  objetivo: AdsObjetivo | null;
  orcamento_nivel: AdsOrcamentoNivel | null;
  investimento_diario_min: number | null;
  investimento_diario_max: number | null;
  investimento_mensal_previsto: number | null;
  orcamento_disponivel: number | null;
  campanha_nome: string | null;
  campanha_estrategia: string | null;
  publicos: Json;
  conjuntos_anuncios: Json;
  anuncios: Json;
  created_at: string;
  updated_at: string;
};

export type ExecutionPlanStatus = "active" | "completed" | "archived";

export type ExecutionTaskStatus = "pending" | "completed";

export type ExecutionTaskCategoria = "diaria" | "semanal";

export type ExecutionTaskArea =
  | "marketing"
  | "negocios"
  | "saude"
  | "desenvolvimento"
  | "relacionamentos";

export type ExecutionTaskModulo =
  | "ceo"
  | "money"
  | "orchestrator"
  | "launch"
  | "creator"
  | "social"
  | "alvesz"
  | "financeiro"
  | "calendario"
  | "saude"
  | "idiomas"
  | "operation-center";

export type ExecutionPlan = {
  id: string;
  user_id: string;
  plan_date: string;
  titulo: string | null;
  status: ExecutionPlanStatus;
  briefing: Json;
  score_execucao: number | null;
  missoes_concluidas: number;
  missoes_total: number;
  resumo: string | null;
  created_at: string;
  updated_at: string;
};

export type ExecutionTask = {
  id: string;
  user_id: string;
  plan_id: string;
  task_key: string;
  titulo: string;
  descricao: string;
  categoria: ExecutionTaskCategoria;
  area: ExecutionTaskArea;
  modulo_origem: ExecutionTaskModulo;
  prioridade: number;
  impacto: number;
  urgencia: number;
  roi: number;
  energia: number;
  href: string | null;
  source_ref: string | null;
  status: ExecutionTaskStatus;
  task_date: string | null;
  semana: number | null;
  ordem: number;
  completed_at: string | null;
  xp_reward: number;
  created_at: string;
  updated_at: string;
};

export type ExecutionHistoryEntry = {
  id: string;
  user_id: string;
  plan_id: string | null;
  task_id: string | null;
  evento: string;
  modulo: string | null;
  detalhes: Json;
  xp_ganho: number;
  created_at: string;
};

export type PerformanceReportStatus = "active" | "archived";

export type PerformancePeriod = "daily" | "weekly" | "monthly";

export type PerformanceInsightTipo =
  | "oportunidade"
  | "risco"
  | "desperdicio"
  | "projeto"
  | "funcionando"
  | "atrasando"
  | "acelerar"
  | "abandonar"
  | "potencial";

export type PerformanceReport = {
  id: string;
  user_id: string;
  report_date: string;
  period: PerformancePeriod;
  status: PerformanceReportStatus;
  titulo: string | null;
  resumo: string | null;
  score_performance: number | null;
  ai_analysis: Json;
  panel: Json;
  executive_memory: Json;
  created_at: string;
  updated_at: string;
};

export type PerformanceMetric = {
  id: string;
  user_id: string;
  report_id: string;
  metric_key: string;
  metric_label: string;
  metric_value: number;
  metric_formatted: string | null;
  modulo: string | null;
  created_at: string;
};

export type PerformanceInsight = {
  id: string;
  user_id: string;
  report_id: string;
  tipo: PerformanceInsightTipo;
  titulo: string;
  descricao: string;
  score: number;
  modulo: string | null;
  created_at: string;
};

export type OrchestrationStatus = "draft" | "prepared" | "completed";

export type SmartLaunchProductType = "proprio" | "afiliado";
export type SmartLaunchStatus = "draft" | "preparing" | "prepared" | "failed";

export type AuraSmartLaunchSession = {
  id: string;
  user_id: string;
  product_type: SmartLaunchProductType;
  target_country: string;
  target_language: string;
  currency: string;
  meta_financeira: number | null;
  orcamento_disponivel: number | null;
  current_step: number;
  status: SmartLaunchStatus;
  safe_mode: boolean;
  ideia: string | null;
  nicho: string | null;
  product_id: string | null;
  research_id: string | null;
  copylab_id: string | null;
  factory_id: string | null;
  landing_id: string | null;
  asset_id: string | null;
  ads_campaign_id: string | null;
  orchestration_id: string | null;
  smart_score: Json;
  generated_outputs: Json;
  estrategia: string | null;
  resumo: string | null;
  created_at: string;
  updated_at: string;
};

export type CreatorCampaignOrchestration = {
  id: string;
  user_id: string;
  product_id: string | null;
  research_id: string | null;
  copylab_id: string | null;
  asset_id: string | null;
  landing_id: string | null;
  ads_campaign_id: string | null;
  launch_plan_id: string | null;
  status: OrchestrationStatus;
  pipeline_step: string | null;
  score_lancamento: number | null;
  probabilidade_sucesso: number | null;
  investimento_necessario: number | null;
  receita_prevista: number | null;
  roi_estimado: number | null;
  orcamento_sugerido: Json;
  orcamento_disponivel: number | null;
  plano_lancamento: Json;
  conexoes: Json;
  riscos: Json;
  resumo: string | null;
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
  | "social_media"
  | "legado";

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
  | "financial_goal_reached"
  | "autopilot_action_required"
  | "autopilot_rule_triggered"
  | "autopilot_campaign_paused"
  | "autopilot_opportunity_found";

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

export type AgentHistory = {
  id: string;
  user_id: string;
  agent_id: string;
  user_message: string;
  agent_response: string;
  consulted_agents: Json;
  metadata: Json;
  created_at: string;
};

export type IntegrationConnectionStatus =
  | "connected"
  | "disconnected"
  | "error"
  | "coming_soon";
export type MetaCampaignStatus = "draft" | "active" | "paused" | "archived" | "pending_review";
export type PlatformResultType =
  | "revenue"
  | "commission"
  | "campaign_metrics"
  | "affiliate_analysis"
  | "sync_summary";
export type PlatformResultPlatform = "meta" | "kiwify" | "hotmart" | "eduzz" | "monetizze";

export type MetaConnection = {
  id: string;
  user_id: string;
  business_id: string | null;
  business_name: string | null;
  access_token_encrypted: string;
  token_expires_at: string | null;
  status: IntegrationConnectionStatus;
  scopes: string[];
  metadata: Json;
  last_sync_at: string | null;
  last_error: string | null;
  created_at: string;
  updated_at: string;
};

export type MetaAdAccount = {
  id: string;
  user_id: string;
  connection_id: string;
  external_account_id: string;
  name: string;
  currency: string;
  timezone: string | null;
  status: string;
  metadata: Json;
  last_synced_at: string | null;
  created_at: string;
  updated_at: string;
};

export type MetaCampaign = {
  id: string;
  user_id: string;
  connection_id: string;
  ad_account_id: string | null;
  external_campaign_id: string | null;
  creator_campaign_id: string | null;
  name: string;
  status: MetaCampaignStatus;
  effective_status: string | null;
  objective: string | null;
  daily_budget_cents: number | null;
  currency: string;
  aura_created: boolean;
  requires_approval: boolean;
  metadata: Json;
  last_synced_at: string | null;
  created_at: string;
  updated_at: string;
};

export type MetaCampaignMetric = {
  id: string;
  user_id: string;
  campaign_id: string;
  ctr: number;
  cpa: number;
  roas: number;
  spend_cents: number;
  impressions: number;
  clicks: number;
  conversions: number;
  frequency: number;
  budget_spent_pct: number;
  metrics_date: string;
  raw_metrics: Json;
  created_at: string;
};

export type MetaMetricEntityType =
  | "account"
  | "campaign"
  | "adset"
  | "ad"
  | "audience"
  | "pixel";

export type MetaMetric = {
  id: string;
  user_id: string;
  entity_type: MetaMetricEntityType;
  entity_id: string;
  entity_name: string | null;
  campaign_id: string | null;
  metrics_date: string;
  ctr: number;
  cpc: number;
  cpm: number;
  cpa: number;
  roas: number;
  frequency: number;
  daily_spend_cents: number;
  conversions: number;
  impressions: number;
  clicks: number;
  spend_cents: number;
  raw_metrics: Json;
  created_at: string;
};

export type MetaInsightType =
  | "saturated_creative"
  | "low_ctr"
  | "high_cpc"
  | "bad_audience"
  | "promising_campaign"
  | "scale_opportunity"
  | "pause_alert"
  | "revenue_gap";

export type MetaInsightSeverity = "info" | "warning" | "success" | "critical";

export type MetaInsight = {
  id: string;
  user_id: string;
  insight_type: MetaInsightType;
  title: string;
  summary: string;
  recommendation: string | null;
  severity: MetaInsightSeverity;
  entity_type: string | null;
  entity_id: string | null;
  entity_name: string | null;
  metrics_snapshot: Json;
  created_at: string;
  expires_at: string | null;
};

export type MetaRecommendationActionType =
  | "generate_creative"
  | "generate_copy"
  | "suggest_pause"
  | "suggest_scale";

export type MetaRecommendationStatus = "pending" | "approved" | "rejected" | "executed";

export type MetaRecommendation = {
  id: string;
  user_id: string;
  action_type: MetaRecommendationActionType;
  status: MetaRecommendationStatus;
  campaign_id: string | null;
  title: string;
  summary: string;
  details: Json;
  requires_approval: boolean;
  created_at: string;
  updated_at: string;
};

export type KiwifyConnection = {
  id: string;
  user_id: string;
  account_id: string;
  credentials_encrypted: string;
  status: IntegrationConnectionStatus;
  account_label: string | null;
  last_sync_at: string | null;
  last_error: string | null;
  metadata: Json;
  created_at: string;
  updated_at: string;
};

export type KiwifyProduct = {
  id: string;
  user_id: string;
  connection_id: string;
  external_product_id: string;
  name: string;
  price_cents: number | null;
  currency: string;
  status: string;
  affiliate_enabled: boolean;
  affiliate_score: number | null;
  metadata: Json;
  last_synced_at: string | null;
  created_at: string;
  updated_at: string;
};

export type KiwifySale = {
  id: string;
  user_id: string;
  connection_id: string;
  external_sale_id: string;
  product_id: string | null;
  external_product_id: string | null;
  product_name: string | null;
  status: string;
  gross_cents: number;
  net_cents: number;
  commission_cents: number;
  currency: string;
  sold_at: string;
  metadata: Json;
  created_at: string;
};

export type KiwifyCommission = {
  id: string;
  user_id: string;
  connection_id: string;
  sale_id: string | null;
  external_commission_id: string | null;
  product_name: string | null;
  amount_cents: number;
  currency: string;
  status: string;
  metadata: Json;
  created_at: string;
  updated_at: string;
};

export type PlatformResult = {
  id: string;
  user_id: string;
  platform: PlatformResultPlatform;
  result_type: PlatformResultType;
  title: string;
  summary: string | null;
  value_cents: number | null;
  currency: string;
  metrics: Json;
  source_id: string | null;
  source_table: string | null;
  routed_to: Json;
  created_at: string;
};

export type IntegrationActionLog = {
  id: string;
  user_id: string;
  platform: "meta" | "kiwify";
  action_type: string;
  status: "success" | "error" | "pending_approval";
  message: string;
  details: Json;
  created_at: string;
};

export type IntegrationConnectionPlatform =
  | "meta"
  | "kiwify"
  | "hotmart"
  | "eduzz"
  | "monetizze"
  | "google_ads"
  | "google_analytics"
  | "stripe"
  | "paypal";

export type IntegrationConnection = {
  id: string;
  user_id: string;
  platform: IntegrationConnectionPlatform;
  status: IntegrationConnectionStatus;
  account_label: string | null;
  stats: Json;
  metadata: Json;
  last_sync_at: string | null;
  next_sync_at: string | null;
  last_error: string | null;
  created_at: string;
  updated_at: string;
};

export type IntegrationSyncLogPlatform = IntegrationConnectionPlatform | "all";

export type IntegrationSyncLog = {
  id: string;
  user_id: string;
  platform: IntegrationSyncLogPlatform;
  status: "success" | "partial" | "error";
  started_at: string;
  finished_at: string | null;
  records_synced: number;
  message: string;
  errors: Json;
  details: Json;
  created_at: string;
};

export type IntegrationEventPlatform = IntegrationSyncLogPlatform;

export type IntegrationEvent = {
  id: string;
  user_id: string;
  platform: IntegrationEventPlatform;
  event_type: "connection" | "sync" | "failure" | "auto_action";
  status: "success" | "error" | "info";
  title: string;
  message: string;
  details: Json;
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
  | "completar_checklist_viagem"
  | "concluir_aula_ingles"
  | "exercicio_ingles_concluido"
  | "modulo_ingles_completo"
  | "missao_prospectar"
  | "missao_postar"
  | "missao_followup"
  | "missao_oferta"
  | "missao_estudar"
  | "missao_analisar"
  | "criar_conteudo"
  | "gerar_roteiro"
  | "publicar_conteudo"
  | "missao_money_concluir"
  | "money_primeira_venda"
  | "money_primeiro_produto"
  | "money_primeiro_lancamento"
  | "money_meta_atingida"
  | "missao_execution_concluir"
  | "execution_plano_completo"
  | "performance_analise_gerar"
  | "autopilot_acao_executar"
  | "autopilot_regras_avaliar";

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
  idempotency_key: string | null;
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
          sync_token?: string | null;
          granted_scopes?: string | null;
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
          | "data_publicada_em"
        > & {
          id?: string;
          formato?: string | null;
          objetivo?: string | null;
          observacoes?: string | null;
          roteiro?: string | null;
          marca?: InstagramMarca | null;
          data_publicada_em?: string | null;
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
      language_progress: TableDef<
        LanguageProgress,
        Omit<
          LanguageProgress,
          | "id"
          | "created_at"
          | "updated_at"
          | "modo_favorito"
          | "nivel"
          | "streak_dias"
          | "ultima_pratica"
          | "aulas_concluidas"
          | "exercicios_concluidos"
          | "modulos_concluidos"
          | "meta_diaria_min"
        > & {
          id?: string;
          modo_favorito?: LanguageModo | null;
          nivel?: LanguageNivel;
          streak_dias?: number;
          ultima_pratica?: string | null;
          aulas_concluidas?: number;
          exercicios_concluidos?: number;
          modulos_concluidos?: number;
          meta_diaria_min?: number;
          created_at?: string;
          updated_at?: string;
        }
      >;
      language_sessions: TableDef<
        LanguageSession,
        Omit<
          LanguageSession,
          | "id"
          | "created_at"
          | "updated_at"
          | "status"
          | "conteudo"
          | "score"
          | "feedback"
          | "duracao_min"
        > & {
          id?: string;
          status?: LanguageSessionStatus;
          conteudo?: Json;
          score?: number | null;
          feedback?: string | null;
          duracao_min?: number;
          created_at?: string;
          updated_at?: string;
        }
      >;
      language_lessons: TableDef<
        LanguageLesson,
        Omit<
          LanguageLesson,
          | "id"
          | "created_at"
          | "updated_at"
          | "session_id"
          | "status"
          | "ordem"
          | "score"
          | "concluido_em"
          | "vocabulario"
          | "frases"
          | "exercicios"
        > & {
          id?: string;
          session_id?: string | null;
          status?: LanguageLessonStatus;
          ordem?: number;
          score?: number | null;
          concluido_em?: string | null;
          vocabulario?: Json;
          frases?: Json;
          exercicios?: Json;
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
      agent_history: TableDef<
        AgentHistory,
        Omit<AgentHistory, "id" | "created_at"> & {
          id?: string;
          consulted_agents?: Json;
          metadata?: Json;
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
          idempotency_key?: string | null;
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
      legacy_timeline: TableDef<
        LegacyTimeline,
        Omit<LegacyTimeline, "id" | "created_at" | "updated_at" | "descricao" | "mes" | "ordem"> & {
          id?: string;
          descricao?: string | null;
          mes?: number | null;
          ordem?: number;
          created_at?: string;
          updated_at?: string;
        }
      >;
      legacy_achievements: TableDef<
        LegacyAchievement,
        Omit<
          LegacyAchievement,
          "id" | "created_at" | "updated_at" | "descricao" | "local" | "ordem"
        > & {
          id?: string;
          descricao?: string | null;
          local?: string | null;
          ordem?: number;
          created_at?: string;
          updated_at?: string;
        }
      >;
      legacy_certificates: TableDef<
        LegacyCertificate,
        Omit<
          LegacyCertificate,
          "id" | "created_at" | "updated_at" | "instituicao" | "descricao" | "ordem"
        > & {
          id?: string;
          instituicao?: string | null;
          descricao?: string | null;
          ordem?: number;
          created_at?: string;
          updated_at?: string;
        }
      >;
      legacy_life_events: TableDef<
        LegacyLifeEvent,
        Omit<
          LegacyLifeEvent,
          "id" | "created_at" | "updated_at" | "descricao" | "ordem" | "tipo_evento"
        > & {
          id?: string;
          descricao?: string | null;
          tipo_evento?: LegacyLifeEventTipo;
          ordem?: number;
          created_at?: string;
          updated_at?: string;
        }
      >;
      legacy_milestones: TableDef<
        LegacyMilestone,
        Omit<
          LegacyMilestone,
          "id" | "created_at" | "updated_at" | "descricao" | "data_marco" | "status" | "ordem"
        > & {
          id?: string;
          descricao?: string | null;
          data_marco?: string | null;
          status?: LegacyMilestoneStatus;
          ordem?: number;
          created_at?: string;
          updated_at?: string;
        }
      >;
      creator_products: TableDef<
        CreatorProduct,
        Omit<
          CreatorProduct,
          | "id"
          | "created_at"
          | "updated_at"
          | "status"
          | "used_aura_data"
          | "nicho"
          | "conhecimento"
          | "publico_alvo_input"
          | "objetivo_financeiro"
          | "prazo"
          | "target_country"
          | "target_language"
          | "currency"
          | "nome"
          | "problema"
          | "solucao"
          | "avatar"
          | "publico_alvo"
          | "promessa"
          | "mecanismo_unico"
          | "diferenciais"
          | "faixa_preco_min"
          | "faixa_preco_max"
          | "formato"
          | "probabilidade_venda"
        > & {
          id?: string;
          status?: CreatorProductStatus;
          used_aura_data?: boolean;
          nicho?: string | null;
          conhecimento?: string | null;
          publico_alvo_input?: string | null;
          objetivo_financeiro?: number | null;
          prazo?: string | null;
          target_country?: string | null;
          target_language?: string | null;
          currency?: string | null;
          nome?: string | null;
          problema?: string | null;
          solucao?: string | null;
          avatar?: string | null;
          publico_alvo?: string | null;
          promessa?: string | null;
          mecanismo_unico?: string | null;
          diferenciais?: string | null;
          faixa_preco_min?: number | null;
          faixa_preco_max?: number | null;
          formato?: string | null;
          probabilidade_venda?: number | null;
          investimento_previsto?: number | null;
          receita_prevista?: number | null;
          roi_estimado?: number | null;
          created_at?: string;
          updated_at?: string;
        }
      >;
      creator_validation: TableDef<
        CreatorValidation,
        Omit<
          CreatorValidation,
          | "id"
          | "created_at"
          | "updated_at"
          | "viabilidade"
          | "lucro_potencial"
          | "tempo_lancar"
          | "compatibilidade_perfil"
        > & {
          id?: string;
          viabilidade?: number | null;
          lucro_potencial?: number | null;
          tempo_lancar?: number | null;
          compatibilidade_perfil?: number | null;
          created_at?: string;
          updated_at?: string;
        }
      >;
      creator_offers: TableDef<
        CreatorOffer,
        Omit<
          CreatorOffer,
          | "id"
          | "created_at"
          | "updated_at"
          | "headline"
          | "subheadline"
          | "bullet_points"
          | "garantia"
          | "bonus"
          | "cta"
        > & {
          id?: string;
          headline?: string | null;
          subheadline?: string | null;
          bullet_points?: Json;
          garantia?: string | null;
          bonus?: string | null;
          cta?: string | null;
          created_at?: string;
          updated_at?: string;
        }
      >;
      creator_launches: TableDef<
        CreatorLaunch,
        Omit<
          CreatorLaunch,
          | "id"
          | "created_at"
          | "updated_at"
          | "status"
          | "potencial_estimado"
          | "launched_at"
          | "notes"
          | "target_country"
          | "target_language"
          | "currency"
        > & {
          id?: string;
          status?: CreatorLaunchStatus;
          potencial_estimado?: number | null;
          launched_at?: string | null;
          notes?: string | null;
          target_country?: string | null;
          target_language?: string | null;
          currency?: string | null;
          created_at?: string;
          updated_at?: string;
        }
      >;
      creator_checklist_items: TableDef<
        CreatorChecklistItem,
        Omit<
          CreatorChecklistItem,
          "id" | "created_at" | "updated_at" | "status" | "ordem"
        > & {
          id?: string;
          status?: CreatorChecklistStatus;
          ordem?: number;
          created_at?: string;
          updated_at?: string;
        }
      >;
      creator_research: TableDef<
        CreatorResearch,
        Omit<
          CreatorResearch,
          | "id"
          | "created_at"
          | "updated_at"
          | "ideia_input"
          | "nicho"
          | "target_country"
          | "target_language"
          | "currency"
          | "publico"
          | "problema"
          | "solucao"
          | "concorrencia_analise"
          | "facilidade_criacao"
          | "facilidade_venda"
          | "demanda"
          | "competicao"
          | "escalabilidade"
          | "potencial_lucro"
          | "compatibilidade_perfil"
          | "nota_final"
          | "avatar"
          | "diferencial_sugerido"
          | "faixa_preco_min"
          | "faixa_preco_max"
          | "product_id"
          | "dores"
          | "desejos"
          | "objecoes"
          | "produtos_concorrentes"
        > & {
          id?: string;
          ideia_input?: string | null;
          nicho?: string | null;
          target_country?: string | null;
          target_language?: string | null;
          currency?: string | null;
          publico?: string | null;
          problema?: string | null;
          solucao?: string | null;
          concorrencia_analise?: string | null;
          facilidade_criacao?: number | null;
          facilidade_venda?: number | null;
          demanda?: number | null;
          competicao?: number | null;
          escalabilidade?: number | null;
          potencial_lucro?: number | null;
          compatibilidade_perfil?: number | null;
          nota_final?: number | null;
          avatar?: string | null;
          diferencial_sugerido?: string | null;
          faixa_preco_min?: number | null;
          faixa_preco_max?: number | null;
          product_id?: string | null;
          dores?: Json;
          desejos?: Json;
          objecoes?: Json;
          produtos_concorrentes?: Json;
          created_at?: string;
          updated_at?: string;
        }
      >;
      creator_launch_plans: TableDef<
        CreatorLaunchPlan,
        Omit<
          CreatorLaunchPlan,
          | "id"
          | "created_at"
          | "updated_at"
          | "titulo"
          | "estagio_atual"
          | "score_ia"
          | "receita_estimada"
          | "data_prevista_lancamento"
          | "orcamento_disponivel"
          | "tarefas"
          | "cronograma"
          | "prioridades"
        > & {
          id?: string;
          titulo?: string | null;
          estagio_atual?: string | null;
          score_ia?: number | null;
          receita_estimada?: number | null;
          data_prevista_lancamento?: string | null;
          orcamento_disponivel?: number | null;
          tarefas?: Json;
          cronograma?: Json;
          prioridades?: Json;
          created_at?: string;
          updated_at?: string;
        }
      >;
      money_mission_plans: TableDef<
        MoneyMissionPlan,
        Omit<
          MoneyMissionPlan,
          | "id"
          | "created_at"
          | "updated_at"
          | "valor_conquistado"
          | "status"
          | "currency"
          | "plano_financeiro"
          | "produtos_recomendados"
          | "servicos_recomendados"
          | "receita_estimada"
          | "investimento_necessario"
          | "roi_estimado"
          | "riscos"
          | "probabilidade_sucesso"
          | "cronograma"
          | "orcamento_disponivel"
        > & {
          id?: string;
          valor_conquistado?: number;
          currency?: string | null;
          status?: MoneyMissionPlanStatus;
          plano_financeiro?: string | null;
          produtos_recomendados?: Json;
          servicos_recomendados?: Json;
          receita_estimada?: number | null;
          investimento_necessario?: number | null;
          roi_estimado?: number | null;
          riscos?: Json;
          probabilidade_sucesso?: number | null;
          cronograma?: Json;
          orcamento_disponivel?: number | null;
          created_at?: string;
          updated_at?: string;
        }
      >;
      money_mission_tasks: TableDef<
        MoneyMissionTask,
        Omit<
          MoneyMissionTask,
          | "id"
          | "created_at"
          | "updated_at"
          | "descricao"
          | "semana"
          | "ordem"
          | "tipo"
          | "status"
          | "mission_date"
          | "completed_at"
          | "xp_reward"
        > & {
          id?: string;
          descricao?: string;
          semana?: number | null;
          ordem?: number;
          tipo?: MoneyMissionTaskTipo;
          status?: MoneyMissionTaskStatus;
          mission_date?: string | null;
          completed_at?: string | null;
          xp_reward?: number;
          created_at?: string;
          updated_at?: string;
        }
      >;
      aura_ceo_sessions: TableDef<
        AuraCeoSession,
        Omit<
          AuraCeoSession,
          | "id"
          | "created_at"
          | "updated_at"
          | "resumo_executivo"
          | "prioridades"
          | "riscos"
          | "oportunidades"
          | "plano_acao"
          | "cronograma"
          | "missoes_recomendadas"
          | "probabilidade_sucesso"
          | "opportunity_radar"
          | "score_ia"
          | "status"
        > & {
          id?: string;
          resumo_executivo?: string | null;
          prioridades?: Json;
          riscos?: Json;
          oportunidades?: Json;
          plano_acao?: string | null;
          cronograma?: Json;
          missoes_recomendadas?: Json;
          probabilidade_sucesso?: number | null;
          opportunity_radar?: Json;
          score_ia?: number | null;
          status?: AuraCeoSessionStatus;
          created_at?: string;
          updated_at?: string;
        }
      >;
      aura_smart_launch_sessions: TableDef<
        AuraSmartLaunchSession,
        Omit<
          AuraSmartLaunchSession,
          | "id"
          | "created_at"
          | "updated_at"
          | "product_type"
          | "target_country"
          | "target_language"
          | "currency"
          | "meta_financeira"
          | "orcamento_disponivel"
          | "current_step"
          | "status"
          | "safe_mode"
          | "ideia"
          | "nicho"
          | "product_id"
          | "research_id"
          | "copylab_id"
          | "factory_id"
          | "landing_id"
          | "asset_id"
          | "ads_campaign_id"
          | "orchestration_id"
          | "smart_score"
          | "generated_outputs"
          | "estrategia"
          | "resumo"
        > & {
          id?: string;
          product_type?: SmartLaunchProductType;
          target_country?: string;
          target_language?: string;
          currency?: string;
          meta_financeira?: number | null;
          orcamento_disponivel?: number | null;
          current_step?: number;
          status?: SmartLaunchStatus;
          safe_mode?: boolean;
          ideia?: string | null;
          nicho?: string | null;
          product_id?: string | null;
          research_id?: string | null;
          copylab_id?: string | null;
          factory_id?: string | null;
          landing_id?: string | null;
          asset_id?: string | null;
          ads_campaign_id?: string | null;
          orchestration_id?: string | null;
          smart_score?: Json;
          generated_outputs?: Json;
          estrategia?: string | null;
          resumo?: string | null;
          created_at?: string;
          updated_at?: string;
        }
      >;
      creator_copylab: TableDef<
        CreatorCopylab,
        Omit<
          CreatorCopylab,
          | "id"
          | "created_at"
          | "updated_at"
          | "product_id"
          | "nome"
          | "avatar"
          | "problema"
          | "solucao"
          | "promessa"
          | "diferencial"
          | "preco"
          | "headline"
          | "subheadline"
          | "big_idea"
          | "mecanismo_unico"
          | "bullets"
          | "garantia"
          | "bonus"
          | "cta"
          | "pagina_vendas"
          | "estrutura_vsl"
          | "storytelling"
          | "email_lancamento"
          | "whatsapp_venda"
          | "instagram_post"
          | "facebook_ad"
          | "google_ad"
        > & {
          id?: string;
          product_id?: string | null;
          nome?: string | null;
          avatar?: string | null;
          problema?: string | null;
          solucao?: string | null;
          promessa?: string | null;
          diferencial?: string | null;
          preco?: number | null;
          headline?: string | null;
          subheadline?: string | null;
          big_idea?: string | null;
          mecanismo_unico?: string | null;
          bullets?: Json;
          garantia?: string | null;
          bonus?: string | null;
          cta?: string | null;
          pagina_vendas?: string | null;
          estrutura_vsl?: string | null;
          storytelling?: string | null;
          email_lancamento?: string | null;
          whatsapp_venda?: string | null;
          instagram_post?: string | null;
          facebook_ad?: string | null;
          google_ad?: string | null;
          created_at?: string;
          updated_at?: string;
        }
      >;
      creator_assets: TableDef<
        CreatorAsset,
        Omit<
          CreatorAsset,
          | "id"
          | "created_at"
          | "updated_at"
          | "product_id"
          | "copylab_id"
          | "nome"
          | "avatar"
          | "problema"
          | "solucao"
          | "promessa"
          | "diferencial"
          | "preco"
          | "criativo_facebook"
          | "criativo_instagram"
          | "capa_ebook"
          | "thumbnail_youtube"
          | "mockup_produto"
          | "roteiro_reels"
          | "roteiro_shorts"
          | "roteiro_tiktok"
          | "vsl"
          | "carrossel_instagram"
          | "stories"
          | "legendas"
          | "cta"
        > & {
          id?: string;
          product_id?: string | null;
          copylab_id?: string | null;
          nome?: string | null;
          avatar?: string | null;
          problema?: string | null;
          solucao?: string | null;
          promessa?: string | null;
          diferencial?: string | null;
          preco?: number | null;
          criativo_facebook?: string | null;
          criativo_instagram?: string | null;
          capa_ebook?: string | null;
          thumbnail_youtube?: string | null;
          mockup_produto?: string | null;
          roteiro_reels?: string | null;
          roteiro_shorts?: string | null;
          roteiro_tiktok?: string | null;
          vsl?: string | null;
          carrossel_instagram?: Json;
          stories?: Json;
          legendas?: string | null;
          cta?: string | null;
          created_at?: string;
          updated_at?: string;
        }
      >;
      creator_landings: TableDef<
        CreatorLanding,
        Omit<
          CreatorLanding,
          | "id"
          | "created_at"
          | "updated_at"
          | "product_id"
          | "copylab_id"
          | "target_country"
          | "target_language"
          | "currency"
          | "modelo"
          | "nome"
          | "avatar"
          | "problema"
          | "solucao"
          | "promessa"
          | "diferencial"
          | "preco"
          | "hero_section"
          | "headline"
          | "subheadline"
          | "beneficios"
          | "section_problema"
          | "section_solucao"
          | "depoimentos"
          | "garantia"
          | "bonus"
          | "faq"
          | "cta"
          | "rodape"
        > & {
          id?: string;
          product_id?: string | null;
          copylab_id?: string | null;
          target_country?: string | null;
          target_language?: string | null;
          currency?: string | null;
          modelo?: LandingModelo;
          nome?: string | null;
          avatar?: string | null;
          problema?: string | null;
          solucao?: string | null;
          promessa?: string | null;
          diferencial?: string | null;
          preco?: number | null;
          hero_section?: string | null;
          headline?: string | null;
          subheadline?: string | null;
          beneficios?: Json;
          section_problema?: string | null;
          section_solucao?: string | null;
          depoimentos?: Json;
          garantia?: string | null;
          bonus?: string | null;
          faq?: Json;
          cta?: string | null;
          rodape?: string | null;
          created_at?: string;
          updated_at?: string;
        }
      >;
      creator_ads_campaigns: TableDef<
        CreatorAdsCampaign,
        Omit<
          CreatorAdsCampaign,
          | "id"
          | "created_at"
          | "updated_at"
          | "product_id"
          | "asset_id"
          | "landing_id"
          | "copylab_id"
          | "target_country"
          | "target_language"
          | "currency"
          | "status"
          | "nome"
          | "avatar"
          | "problema"
          | "solucao"
          | "promessa"
          | "diferencial"
          | "preco"
          | "objetivo"
          | "orcamento_nivel"
          | "investimento_diario_min"
          | "investimento_diario_max"
          | "investimento_mensal_previsto"
          | "orcamento_disponivel"
          | "campanha_nome"
          | "campanha_estrategia"
          | "publicos"
          | "conjuntos_anuncios"
          | "anuncios"
        > & {
          id?: string;
          product_id?: string | null;
          asset_id?: string | null;
          landing_id?: string | null;
          copylab_id?: string | null;
          target_country?: string | null;
          target_language?: string | null;
          currency?: string | null;
          status?: AdsCampaignStatus;
          nome?: string | null;
          avatar?: string | null;
          problema?: string | null;
          solucao?: string | null;
          promessa?: string | null;
          diferencial?: string | null;
          preco?: number | null;
          objetivo?: AdsObjetivo | null;
          orcamento_nivel?: AdsOrcamentoNivel | null;
          investimento_diario_min?: number | null;
          investimento_diario_max?: number | null;
          investimento_mensal_previsto?: number | null;
          orcamento_disponivel?: number | null;
          campanha_nome?: string | null;
          campanha_estrategia?: string | null;
          publicos?: Json;
          conjuntos_anuncios?: Json;
          anuncios?: Json;
          created_at?: string;
          updated_at?: string;
        }
      >;
      creator_campaign_orchestrations: TableDef<
        CreatorCampaignOrchestration,
        Omit<
          CreatorCampaignOrchestration,
          | "id"
          | "created_at"
          | "updated_at"
          | "product_id"
          | "research_id"
          | "copylab_id"
          | "asset_id"
          | "landing_id"
          | "ads_campaign_id"
          | "launch_plan_id"
          | "status"
          | "pipeline_step"
          | "score_lancamento"
          | "probabilidade_sucesso"
          | "investimento_necessario"
          | "receita_prevista"
          | "roi_estimado"
          | "orcamento_sugerido"
          | "orcamento_disponivel"
          | "plano_lancamento"
          | "conexoes"
          | "riscos"
          | "resumo"
        > & {
          id?: string;
          product_id?: string | null;
          research_id?: string | null;
          copylab_id?: string | null;
          asset_id?: string | null;
          landing_id?: string | null;
          ads_campaign_id?: string | null;
          launch_plan_id?: string | null;
          status?: OrchestrationStatus;
          pipeline_step?: string | null;
          score_lancamento?: number | null;
          probabilidade_sucesso?: number | null;
          investimento_necessario?: number | null;
          receita_prevista?: number | null;
          roi_estimado?: number | null;
          orcamento_sugerido?: Json;
          orcamento_disponivel?: number | null;
          plano_lancamento?: Json;
          conexoes?: Json;
          riscos?: Json;
          resumo?: string | null;
          created_at?: string;
          updated_at?: string;
        }
      >;
      execution_plans: TableDef<
        ExecutionPlan,
        Omit<
          ExecutionPlan,
          | "id"
          | "created_at"
          | "updated_at"
          | "titulo"
          | "status"
          | "briefing"
          | "score_execucao"
          | "missoes_concluidas"
          | "missoes_total"
          | "resumo"
        > & {
          id?: string;
          titulo?: string | null;
          status?: ExecutionPlanStatus;
          briefing?: Json;
          score_execucao?: number | null;
          missoes_concluidas?: number;
          missoes_total?: number;
          resumo?: string | null;
          created_at?: string;
          updated_at?: string;
        }
      >;
      execution_tasks: TableDef<
        ExecutionTask,
        Omit<
          ExecutionTask,
          | "id"
          | "created_at"
          | "updated_at"
          | "descricao"
          | "categoria"
          | "area"
          | "modulo_origem"
          | "prioridade"
          | "impacto"
          | "urgencia"
          | "roi"
          | "energia"
          | "href"
          | "source_ref"
          | "status"
          | "task_date"
          | "semana"
          | "ordem"
          | "completed_at"
          | "xp_reward"
        > & {
          id?: string;
          descricao?: string;
          categoria?: ExecutionTaskCategoria;
          area?: ExecutionTaskArea;
          modulo_origem?: ExecutionTaskModulo;
          prioridade?: number;
          impacto?: number;
          urgencia?: number;
          roi?: number;
          energia?: number;
          href?: string | null;
          source_ref?: string | null;
          status?: ExecutionTaskStatus;
          task_date?: string | null;
          semana?: number | null;
          ordem?: number;
          completed_at?: string | null;
          xp_reward?: number;
          created_at?: string;
          updated_at?: string;
        }
      >;
      execution_history: TableDef<
        ExecutionHistoryEntry,
        Omit<
          ExecutionHistoryEntry,
          | "id"
          | "created_at"
          | "plan_id"
          | "task_id"
          | "modulo"
          | "detalhes"
          | "xp_ganho"
        > & {
          id?: string;
          plan_id?: string | null;
          task_id?: string | null;
          modulo?: string | null;
          detalhes?: Json;
          xp_ganho?: number;
          created_at?: string;
        }
      >;
      performance_reports: TableDef<
        PerformanceReport,
        Omit<
          PerformanceReport,
          | "id"
          | "created_at"
          | "updated_at"
          | "period"
          | "status"
          | "titulo"
          | "resumo"
          | "score_performance"
          | "ai_analysis"
          | "panel"
          | "executive_memory"
        > & {
          id?: string;
          period?: PerformancePeriod;
          status?: PerformanceReportStatus;
          titulo?: string | null;
          resumo?: string | null;
          score_performance?: number | null;
          ai_analysis?: Json;
          panel?: Json;
          executive_memory?: Json;
          created_at?: string;
          updated_at?: string;
        }
      >;
      performance_metrics: TableDef<
        PerformanceMetric,
        Omit<
          PerformanceMetric,
          | "id"
          | "created_at"
          | "metric_value"
          | "metric_formatted"
          | "modulo"
        > & {
          id?: string;
          metric_value?: number;
          metric_formatted?: string | null;
          modulo?: string | null;
          created_at?: string;
        }
      >;
      performance_insights: TableDef<
        PerformanceInsight,
        Omit<
          PerformanceInsight,
          | "id"
          | "created_at"
          | "descricao"
          | "score"
          | "modulo"
        > & {
          id?: string;
          descricao?: string;
          score?: number;
          modulo?: string | null;
          created_at?: string;
        }
      >;
      autopilot_rules: TableDef<
        AutopilotSettings,
        Omit<AutopilotSettings, "created_at" | "updated_at" | "control_level" | "rules"> & {
          control_level?: AutopilotControlLevel;
          rules?: Json;
          created_at?: string;
          updated_at?: string;
        }
      >;
      autopilot_monitors: TableDef<
        AutopilotMonitor,
        Omit<
          AutopilotMonitor,
          | "id"
          | "created_at"
          | "updated_at"
          | "monitor_status"
          | "metrics"
          | "last_evaluated_at"
        > & {
          id?: string;
          monitor_status?: AutopilotMonitorStatus;
          metrics?: Json;
          last_evaluated_at?: string | null;
          created_at?: string;
          updated_at?: string;
        }
      >;
      autopilot_actions: TableDef<
        AutopilotAction,
        Omit<
          AutopilotAction,
          | "id"
          | "created_at"
          | "updated_at"
          | "campaign_id"
          | "trigger_type"
          | "rule_key"
          | "status"
          | "requires_approval"
          | "metric_detected"
          | "metric_value"
          | "reason"
          | "suggestion"
          | "payload"
          | "executed_at"
        > & {
          id?: string;
          campaign_id?: string | null;
          trigger_type?: AutopilotTriggerType;
          rule_key?: string | null;
          status?: AutopilotActionStatus;
          requires_approval?: boolean;
          metric_detected?: string | null;
          metric_value?: number | null;
          reason?: string | null;
          suggestion?: string | null;
          payload?: Json;
          executed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        }
      >;
      autopilot_logs: TableDef<
        AutopilotLog,
        Omit<
          AutopilotLog,
          "id" | "created_at" | "campaign_id" | "action_id" | "details"
        > & {
          id?: string;
          campaign_id?: string | null;
          action_id?: string | null;
          details?: Json;
          created_at?: string;
        }
      >;
      product_factory: TableDef<
        ProductFactory,
        Omit<
          ProductFactory,
          | "id"
          | "created_at"
          | "updated_at"
          | "product_id"
          | "copylab_id"
          | "research_id"
          | "titulo"
          | "promessa"
          | "avatar"
          | "problema"
          | "solucao"
          | "capitulos"
          | "conteudo"
          | "exercicios"
          | "bonus"
          | "checklist"
          | "conclusao"
          | "design"
          | "status"
          | "current_version"
          | "product_type"
          | "subtitulo"
          | "publico"
          | "objetivo"
        > & {
          id?: string;
          product_id?: string | null;
          copylab_id?: string | null;
          research_id?: string | null;
          product_type?: ProductFactoryType;
          titulo?: string | null;
          subtitulo?: string | null;
          promessa?: string | null;
          avatar?: string | null;
          publico?: string | null;
          objetivo?: string | null;
          problema?: string | null;
          solucao?: string | null;
          capitulos?: Json;
          conteudo?: Json;
          exercicios?: Json;
          bonus?: string | null;
          checklist?: Json;
          conclusao?: string | null;
          design?: Json;
          status?: ProductFactoryStatus;
          current_version?: number;
          created_at?: string;
          updated_at?: string;
        }
      >;
      product_files: TableDef<
        ProductFile,
        Omit<
          ProductFile,
          | "id"
          | "created_at"
          | "file_type"
          | "storage_path"
          | "file_url"
          | "file_name"
          | "mime_type"
          | "size_bytes"
          | "version_number"
        > & {
          id?: string;
          file_type?: ProductFileType;
          storage_path?: string;
          file_url?: string | null;
          file_name?: string | null;
          mime_type?: string;
          size_bytes?: number | null;
          version_number?: number;
          created_at?: string;
        }
      >;
      product_versions: TableDef<
        ProductVersion,
        Omit<
          ProductVersion,
          | "id"
          | "created_at"
          | "snapshot"
          | "changelog"
          | "file_id"
          | "version_number"
          | "version_label"
        > & {
          id?: string;
          version_number?: number;
          version_label?: ProductVersionLabel | null;
          snapshot?: Json;
          changelog?: string | null;
          file_id?: string | null;
          created_at?: string;
        }
      >;
      product_compliance_checks: TableDef<
        ProductComplianceCheck,
        Omit<
          ProductComplianceCheck,
          | "id"
          | "created_at"
          | "updated_at"
          | "risk_score"
          | "risk_level"
          | "forbidden_claims"
          | "misleading_risks"
          | "ad_checklist"
          | "recommendations"
          | "status"
          | "notes"
        > & {
          id?: string;
          risk_score?: number | null;
          risk_level?: ProductComplianceRiskLevel | null;
          forbidden_claims?: Json;
          misleading_risks?: Json;
          ad_checklist?: Json;
          recommendations?: Json;
          status?: ProductComplianceStatus;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        }
      >;
      creative_assets: TableDef<
        CreativeAsset,
        Omit<
          CreativeAsset,
          | "id"
          | "created_at"
          | "updated_at"
          | "operation_id"
          | "product_id"
          | "asset_type"
          | "title"
          | "prompt"
          | "copy"
          | "format"
          | "status"
          | "file_url"
          | "storage_path"
          | "thumbnail_url"
          | "metadata"
        > & {
          id?: string;
          operation_id?: string | null;
          product_id?: string | null;
          asset_type?: CreativeAssetType;
          title?: string | null;
          prompt?: string | null;
          copy?: string | null;
          format?: string | null;
          status?: CreativeAssetStatus;
          file_url?: string | null;
          storage_path?: string | null;
          thumbnail_url?: string | null;
          metadata?: Json;
          created_at?: string;
          updated_at?: string;
        }
      >;
      ad_campaigns: TableDef<
        AdCampaign,
        Omit<
          AdCampaign,
          | "id"
          | "created_at"
          | "updated_at"
          | "operation_id"
          | "platform"
          | "campaign_name"
          | "objective"
          | "budget"
          | "country"
          | "language"
          | "audience"
          | "creatives_json"
          | "copy_json"
          | "landing_id"
          | "status"
          | "approval_required"
          | "metadata"
        > & {
          id?: string;
          operation_id?: string | null;
          platform?: AdPlatform;
          campaign_name?: string;
          objective?: string | null;
          budget?: number | null;
          country?: string | null;
          language?: string | null;
          audience?: Json;
          creatives_json?: Json;
          copy_json?: Json;
          landing_id?: string | null;
          status?: AdCampaignStatus;
          approval_required?: boolean;
          metadata?: Json;
          created_at?: string;
          updated_at?: string;
        }
      >;
      ad_sets: TableDef<
        AdSet,
        Omit<
          AdSet,
          "id" | "created_at" | "campaign_id" | "audience" | "placements" | "budget" | "status" | "metadata"
        > & {
          id?: string;
          campaign_id?: string;
          audience?: Json;
          placements?: Json;
          budget?: number | null;
          status?: AdSetStatus;
          metadata?: Json;
          created_at?: string;
        }
      >;
      ad_creatives: TableDef<
        AdCreative,
        Omit<
          AdCreative,
          | "id"
          | "created_at"
          | "campaign_id"
          | "creative_asset_id"
          | "headline"
          | "primary_text"
          | "description"
          | "cta"
          | "status"
          | "metadata"
        > & {
          id?: string;
          campaign_id?: string;
          creative_asset_id?: string | null;
          headline?: string | null;
          primary_text?: string | null;
          description?: string | null;
          cta?: string | null;
          status?: AdCreativeStatus;
          metadata?: Json;
          created_at?: string;
        }
      >;
      landing_pages: TableDef<
        LandingPage,
        Omit<
          LandingPage,
          | "id"
          | "created_at"
          | "updated_at"
          | "operation_id"
          | "product_id"
          | "title"
          | "slug"
          | "headline"
          | "subheadline"
          | "hero_copy"
          | "benefits_json"
          | "proof_json"
          | "offer_json"
          | "faq_json"
          | "cta_text"
          | "html"
          | "status"
          | "preview_url"
          | "published_url"
          | "metadata"
        > & {
          id?: string;
          operation_id?: string | null;
          product_id?: string | null;
          title?: string | null;
          slug?: string;
          headline?: string | null;
          subheadline?: string | null;
          hero_copy?: string | null;
          benefits_json?: Json;
          proof_json?: Json;
          offer_json?: Json;
          faq_json?: Json;
          cta_text?: string | null;
          html?: string | null;
          status?: LandingPageStatus;
          preview_url?: string | null;
          published_url?: string | null;
          metadata?: Json;
          created_at?: string;
          updated_at?: string;
        }
      >;
      funnels: TableDef<
        Funnel,
        Omit<
          Funnel,
          | "id"
          | "created_at"
          | "updated_at"
          | "operation_id"
          | "product_id"
          | "funnel_name"
          | "niche"
          | "status"
          | "funnel_type"
          | "total_steps"
          | "expected_aov"
          | "expected_conversion"
          | "metadata"
        > & {
          id?: string;
          operation_id?: string | null;
          product_id?: string | null;
          funnel_name?: string;
          niche?: string | null;
          status?: FunnelStatus;
          funnel_type?: FunnelType;
          total_steps?: number;
          expected_aov?: number | null;
          expected_conversion?: number | null;
          metadata?: Json;
          created_at?: string;
          updated_at?: string;
        }
      >;
      funnel_steps: TableDef<
        FunnelStep,
        Omit<
          FunnelStep,
          | "id"
          | "created_at"
          | "step_order"
          | "step_type"
          | "product_id"
          | "landing_id"
          | "copy_id"
          | "creative_id"
          | "offer_id"
          | "status"
          | "metadata"
        > & {
          id?: string;
          funnel_id: string;
          step_order?: number;
          step_type?: FunnelStepType;
          product_id?: string | null;
          landing_id?: string | null;
          copy_id?: string | null;
          creative_id?: string | null;
          offer_id?: string | null;
          status?: FunnelStepStatus;
          metadata?: Json;
          created_at?: string;
        }
      >;
      offers: TableDef<
        Offer,
        Omit<
          Offer,
          | "id"
          | "created_at"
          | "updated_at"
          | "funnel_id"
          | "product_id"
          | "offer_type"
          | "title"
          | "description"
          | "price"
          | "currency"
          | "expected_take_rate"
          | "expected_revenue"
          | "status"
          | "metadata"
        > & {
          id?: string;
          funnel_id?: string | null;
          product_id?: string | null;
          offer_type?: OfferType;
          title?: string;
          description?: string | null;
          price?: number;
          currency?: string;
          expected_take_rate?: number | null;
          expected_revenue?: number | null;
          status?: OfferStatus;
          metadata?: Json;
          created_at?: string;
          updated_at?: string;
        }
      >;
      platform_connections: TableDef<
        PlatformConnection,
        Omit<
          PlatformConnection,
          | "id"
          | "created_at"
          | "updated_at"
          | "platform"
          | "auth_type"
          | "status"
          | "account_label"
          | "external_account_id"
          | "credentials_encrypted"
          | "metadata"
          | "last_sync_at"
          | "last_error"
        > & {
          id?: string;
          platform?: PlatformId;
          auth_type?: PlatformAuthType;
          status?: PlatformConnectionStatus;
          account_label?: string | null;
          external_account_id?: string | null;
          credentials_encrypted?: string;
          metadata?: Json;
          last_sync_at?: string | null;
          last_error?: string | null;
          created_at?: string;
          updated_at?: string;
        }
      >;
      platform_sync_logs: TableDef<
        PlatformSyncLog,
        Omit<
          PlatformSyncLog,
          | "id"
          | "created_at"
          | "connection_id"
          | "platform"
          | "sync_type"
          | "status"
          | "records_synced"
          | "payload_summary"
          | "error_message"
        > & {
          id?: string;
          connection_id?: string;
          platform?: string;
          sync_type?: PlatformSyncType;
          status?: PlatformSyncStatus;
          records_synced?: number;
          payload_summary?: Json;
          error_message?: string | null;
          created_at?: string;
        }
      >;
      affiliate_products: TableDef<
        AffiliateProduct,
        Omit<
          AffiliateProduct,
          | "id"
          | "created_at"
          | "updated_at"
          | "connection_id"
          | "platform"
          | "external_product_id"
          | "name"
          | "price_cents"
          | "commission_cents"
          | "commission_pct"
          | "currency"
          | "status"
          | "affiliate_enabled"
          | "metadata"
          | "last_synced_at"
        > & {
          id?: string;
          connection_id?: string | null;
          platform?: string;
          external_product_id?: string;
          name?: string;
          price_cents?: number | null;
          commission_cents?: number | null;
          commission_pct?: number | null;
          currency?: string;
          status?: string;
          affiliate_enabled?: boolean;
          metadata?: Json;
          last_synced_at?: string | null;
          created_at?: string;
          updated_at?: string;
        }
      >;
      affiliate_analysis: TableDef<
        AffiliateAnalysis,
        Omit<
          AffiliateAnalysis,
          | "id"
          | "created_at"
          | "updated_at"
          | "platform"
          | "affiliate_product_id"
          | "analysis_type"
          | "ai_score"
          | "ticket_medio"
          | "potencial_venda"
          | "concorrencia"
          | "legado_compat"
          | "summary"
          | "insights"
          | "raw_input"
        > & {
          id?: string;
          platform?: string | null;
          affiliate_product_id?: string | null;
          analysis_type?: AffiliateAnalysisType;
          ai_score?: number | null;
          ticket_medio?: number | null;
          potencial_venda?: number | null;
          concorrencia?: string | null;
          legado_compat?: string | null;
          summary?: string | null;
          insights?: Json;
          raw_input?: Json;
          created_at?: string;
          updated_at?: string;
        }
      >;
      global_markets: TableDef<
        GlobalMarket,
        Omit<
          GlobalMarket,
          | "id"
          | "created_at"
          | "updated_at"
          | "country"
          | "language"
          | "currency"
          | "product_type"
          | "objective"
          | "product_name"
          | "creator_product_id"
          | "status"
          | "global_score"
          | "score_financial"
          | "score_competition"
          | "score_entry_ease"
          | "score_skills_alignment"
          | "metadata"
        > & {
          id?: string;
          country?: string;
          language?: string;
          currency?: GlobalCurrency;
          product_type?: GlobalProductType;
          objective?: GlobalObjective;
          product_name?: string | null;
          creator_product_id?: string | null;
          status?: GlobalMarketStatus;
          global_score?: number | null;
          score_financial?: number | null;
          score_competition?: number | null;
          score_entry_ease?: number | null;
          score_skills_alignment?: number | null;
          metadata?: Json;
          created_at?: string;
          updated_at?: string;
        }
      >;
      global_strategies: TableDef<
        GlobalStrategy,
        Omit<
          GlobalStrategy,
          | "id"
          | "created_at"
          | "updated_at"
          | "market_id"
          | "suggested_price"
          | "currency"
          | "audience"
          | "channels"
          | "difficulty"
          | "profit_potential"
          | "profit_potential_score"
          | "ai_summary"
          | "raw_analysis"
          | "status"
        > & {
          id?: string;
          market_id?: string;
          suggested_price?: number | null;
          currency?: GlobalCurrency;
          audience?: string | null;
          channels?: Json;
          difficulty?: GlobalDifficulty;
          profit_potential?: GlobalProfitPotential;
          profit_potential_score?: number | null;
          ai_summary?: string | null;
          raw_analysis?: Json;
          status?: GlobalStrategyStatus;
          created_at?: string;
          updated_at?: string;
        }
      >;
      global_results: TableDef<
        GlobalResult,
        Omit<
          GlobalResult,
          | "id"
          | "created_at"
          | "updated_at"
          | "market_id"
          | "strategy_id"
          | "currency"
          | "revenue_amount"
          | "revenue_converted_brl"
          | "product_name"
          | "period_start"
          | "period_end"
          | "source"
          | "metadata"
        > & {
          id?: string;
          market_id?: string | null;
          strategy_id?: string | null;
          currency?: GlobalCurrency;
          revenue_amount?: number;
          revenue_converted_brl?: number;
          product_name?: string | null;
          period_start?: string | null;
          period_end?: string | null;
          source?: GlobalResultSource;
          metadata?: Json;
          created_at?: string;
          updated_at?: string;
        }
      >;
      knowledge_entries: TableDef<
        KnowledgeEntry,
        Omit<
          KnowledgeEntry,
          | "id"
          | "created_at"
          | "updated_at"
          | "entry_type"
          | "category"
          | "connector"
          | "title"
          | "description"
          | "country"
          | "currency"
          | "performance_score"
          | "metrics"
          | "source_ref"
          | "status"
          | "metadata"
        > & {
          id?: string;
          entry_type?: KnowledgeEntryType;
          category?: KnowledgeEntryCategory;
          connector?: KnowledgeConnector;
          title?: string;
          description?: string | null;
          country?: string | null;
          currency?: KnowledgeCurrency | null;
          performance_score?: number | null;
          metrics?: Json;
          source_ref?: string | null;
          status?: KnowledgeEntryStatus;
          metadata?: Json;
          created_at?: string;
          updated_at?: string;
        }
      >;
      knowledge_insights: TableDef<
        KnowledgeInsight,
        Omit<
          KnowledgeInsight,
          | "id"
          | "created_at"
          | "updated_at"
          | "insight_type"
          | "title"
          | "summary"
          | "priority"
          | "status"
          | "related_entry_ids"
          | "metadata"
        > & {
          id?: string;
          insight_type?: KnowledgeInsightType;
          title?: string;
          summary?: string;
          priority?: KnowledgeInsightPriority;
          status?: KnowledgeInsightStatus;
          related_entry_ids?: Json;
          metadata?: Json;
          created_at?: string;
          updated_at?: string;
        }
      >;
      knowledge_patterns: TableDef<
        KnowledgePattern,
        Omit<
          KnowledgePattern,
          | "id"
          | "created_at"
          | "updated_at"
          | "pattern_type"
          | "label"
          | "description"
          | "country"
          | "currency"
          | "confidence_score"
          | "evidence_count"
          | "metrics"
          | "metadata"
        > & {
          id?: string;
          pattern_type?: KnowledgePatternType;
          label?: string;
          description?: string | null;
          country?: string | null;
          currency?: KnowledgeCurrency | null;
          confidence_score?: number;
          evidence_count?: number;
          metrics?: Json;
          metadata?: Json;
          created_at?: string;
          updated_at?: string;
        }
      >;
      market_history: TableDef<
        MarketHistory,
        Omit<
          MarketHistory,
          | "id"
          | "created_at"
          | "updated_at"
          | "country"
          | "currency"
          | "market_label"
          | "period_start"
          | "period_end"
          | "sales_amount"
          | "sales_count"
          | "roas"
          | "ctr"
          | "conversion_rate"
          | "connector"
          | "metadata"
        > & {
          id?: string;
          country?: string;
          currency?: KnowledgeCurrency;
          market_label?: string | null;
          period_start?: string | null;
          period_end?: string | null;
          sales_amount?: number;
          sales_count?: number;
          roas?: number | null;
          ctr?: number | null;
          conversion_rate?: number | null;
          connector?: KnowledgeConnector;
          metadata?: Json;
          created_at?: string;
          updated_at?: string;
        }
      >;
      meta_connections: TableDef<
        MetaConnection,
        Omit<MetaConnection, "id" | "created_at" | "updated_at"> & {
          id?: string;
          business_id?: string | null;
          business_name?: string | null;
          token_expires_at?: string | null;
          scopes?: string[];
          metadata?: Json;
          last_sync_at?: string | null;
          last_error?: string | null;
          created_at?: string;
          updated_at?: string;
        }
      >;
      meta_ad_accounts: TableDef<
        MetaAdAccount,
        Omit<MetaAdAccount, "id" | "created_at" | "updated_at"> & {
          id?: string;
          timezone?: string | null;
          metadata?: Json;
          last_synced_at?: string | null;
          created_at?: string;
          updated_at?: string;
        }
      >;
      meta_campaigns: TableDef<
        MetaCampaign,
        Omit<MetaCampaign, "id" | "created_at" | "updated_at"> & {
          id?: string;
          ad_account_id?: string | null;
          external_campaign_id?: string | null;
          creator_campaign_id?: string | null;
          effective_status?: string | null;
          objective?: string | null;
          daily_budget_cents?: number | null;
          metadata?: Json;
          last_synced_at?: string | null;
          created_at?: string;
          updated_at?: string;
        }
      >;
      meta_campaign_metrics: TableDef<
        MetaCampaignMetric,
        Omit<MetaCampaignMetric, "id" | "created_at"> & {
          id?: string;
          raw_metrics?: Json;
          created_at?: string;
        }
      >;
      meta_metrics: TableDef<
        MetaMetric,
        Omit<MetaMetric, "id" | "created_at"> & {
          id?: string;
          entity_name?: string | null;
          campaign_id?: string | null;
          raw_metrics?: Json;
          created_at?: string;
        }
      >;
      meta_insights: TableDef<
        MetaInsight,
        Omit<MetaInsight, "id" | "created_at"> & {
          id?: string;
          recommendation?: string | null;
          entity_type?: string | null;
          entity_id?: string | null;
          entity_name?: string | null;
          metrics_snapshot?: Json;
          expires_at?: string | null;
          created_at?: string;
        }
      >;
      meta_recommendations: TableDef<
        MetaRecommendation,
        Omit<MetaRecommendation, "id" | "created_at" | "updated_at"> & {
          id?: string;
          campaign_id?: string | null;
          details?: Json;
          created_at?: string;
          updated_at?: string;
        }
      >;
      kiwify_connections: TableDef<
        KiwifyConnection,
        Omit<KiwifyConnection, "id" | "created_at" | "updated_at"> & {
          id?: string;
          account_label?: string | null;
          last_sync_at?: string | null;
          last_error?: string | null;
          metadata?: Json;
          created_at?: string;
          updated_at?: string;
        }
      >;
      kiwify_products: TableDef<
        KiwifyProduct,
        Omit<KiwifyProduct, "id" | "created_at" | "updated_at"> & {
          id?: string;
          price_cents?: number | null;
          affiliate_score?: number | null;
          metadata?: Json;
          last_synced_at?: string | null;
          created_at?: string;
          updated_at?: string;
        }
      >;
      kiwify_sales: TableDef<
        KiwifySale,
        Omit<KiwifySale, "id" | "created_at"> & {
          id?: string;
          product_id?: string | null;
          external_product_id?: string | null;
          product_name?: string | null;
          metadata?: Json;
          created_at?: string;
        }
      >;
      kiwify_commissions: TableDef<
        KiwifyCommission,
        Omit<KiwifyCommission, "id" | "created_at" | "updated_at"> & {
          id?: string;
          sale_id?: string | null;
          external_commission_id?: string | null;
          product_name?: string | null;
          metadata?: Json;
          created_at?: string;
          updated_at?: string;
        }
      >;
      platform_results: TableDef<
        PlatformResult,
        Omit<PlatformResult, "id" | "created_at"> & {
          id?: string;
          summary?: string | null;
          value_cents?: number | null;
          metrics?: Json;
          source_id?: string | null;
          source_table?: string | null;
          routed_to?: Json;
          created_at?: string;
        }
      >;
      integration_action_logs: TableDef<
        IntegrationActionLog,
        Omit<IntegrationActionLog, "id" | "created_at"> & {
          id?: string;
          details?: Json;
          created_at?: string;
        }
      >;
      integration_connections: TableDef<
        IntegrationConnection,
        Omit<IntegrationConnection, "id" | "created_at" | "updated_at"> & {
          id?: string;
          account_label?: string | null;
          stats?: Json;
          metadata?: Json;
          last_sync_at?: string | null;
          next_sync_at?: string | null;
          last_error?: string | null;
          created_at?: string;
          updated_at?: string;
        }
      >;
      integration_sync_logs: TableDef<
        IntegrationSyncLog,
        Omit<IntegrationSyncLog, "id" | "created_at"> & {
          id?: string;
          finished_at?: string | null;
          records_synced?: number;
          message?: string;
          errors?: Json;
          details?: Json;
          created_at?: string;
        }
      >;
      integration_events: TableDef<
        IntegrationEvent,
        Omit<IntegrationEvent, "id" | "created_at"> & {
          id?: string;
          message?: string;
          details?: Json;
          created_at?: string;
        }
      >;
      growth_brain_memories: TableDef<
        GrowthBrainMemory,
        Omit<
          GrowthBrainMemory,
          | "id"
          | "created_at"
          | "status"
          | "metadata"
          | "operation_id"
          | "product_id"
          | "copy_id"
          | "creative_id"
          | "landing_id"
          | "campaign_id"
          | "source_platform"
          | "country"
          | "language"
          | "ctr"
          | "cpc"
          | "cpa"
          | "roas"
          | "revenue"
          | "spend"
          | "conversion_rate"
          | "lesson"
          | "recommendation"
        > & {
          id?: string;
          status?: GrowthBrainMemoryStatus;
          metadata?: Json;
          operation_id?: string | null;
          product_id?: string | null;
          copy_id?: string | null;
          creative_id?: string | null;
          landing_id?: string | null;
          campaign_id?: string | null;
          source_platform?: string | null;
          country?: string | null;
          language?: string | null;
          ctr?: number | null;
          cpc?: number | null;
          cpa?: number | null;
          roas?: number | null;
          revenue?: number | null;
          spend?: number | null;
          conversion_rate?: number | null;
          lesson?: string | null;
          recommendation?: string | null;
          created_at?: string;
        }
      >;
      growth_patterns: TableDef<
        GrowthPattern,
        Omit<
          GrowthPattern,
          | "id"
          | "created_at"
          | "niche"
          | "country"
          | "language"
          | "score"
          | "lesson"
          | "recommendation"
        > & {
          id?: string;
          niche?: string | null;
          country?: string | null;
          language?: string | null;
          score?: number;
          lesson?: string | null;
          recommendation?: string | null;
          created_at?: string;
        }
      >;
      revenue_metrics: TableDef<
        RevenueMetric,
        Omit<
          RevenueMetric,
          | "id"
          | "created_at"
          | "metadata"
          | "operation_id"
          | "product_id"
          | "platform"
          | "country"
          | "currency"
          | "revenue"
          | "spend"
          | "profit"
          | "roas"
          | "roi"
          | "conversions"
          | "clicks"
          | "ctr"
          | "cpc"
          | "cpa"
          | "date"
          | "metric_type"
        > & {
          id?: string;
          metadata?: Json;
          operation_id?: string | null;
          product_id?: string | null;
          platform?: string | null;
          country?: string | null;
          currency?: string;
          metric_type?: RevenueMetricType;
          revenue?: number;
          spend?: number;
          profit?: number;
          roas?: number | null;
          roi?: number | null;
          conversions?: number;
          clicks?: number;
          ctr?: number | null;
          cpc?: number | null;
          cpa?: number | null;
          date?: string;
          created_at?: string;
        }
      >;
      revenue_forecasts: TableDef<
        RevenueForecast,
        Omit<
          RevenueForecast,
          | "id"
          | "created_at"
          | "metadata"
          | "forecast_type"
          | "period"
          | "predicted_revenue"
          | "predicted_profit"
          | "confidence"
          | "recommendation"
        > & {
          id?: string;
          metadata?: Json;
          forecast_type?: RevenueForecastType;
          period?: RevenueForecastPeriod;
          predicted_revenue?: number;
          predicted_profit?: number;
          confidence?: number;
          recommendation?: string | null;
          created_at?: string;
        }
      >;
      market_opportunities: TableDef<
        MarketOpportunity,
        Omit<
          MarketOpportunity,
          | "id"
          | "created_at"
          | "metadata"
          | "source_platform"
          | "niche"
          | "country"
          | "language"
          | "currency"
          | "estimated_demand"
          | "estimated_competition"
          | "estimated_conversion"
          | "opportunity_score"
          | "recommendation"
        > & {
          id?: string;
          metadata?: Json;
          source_platform?: string | null;
          niche?: string | null;
          country?: string | null;
          language?: string | null;
          currency?: string;
          estimated_demand?: number | null;
          estimated_competition?: number | null;
          estimated_conversion?: number | null;
          opportunity_score?: number;
          recommendation?: string | null;
          created_at?: string;
        }
      >;
      market_watchlist: TableDef<
        MarketWatchlist,
        Omit<
          MarketWatchlist,
          | "id"
          | "created_at"
          | "source_platform"
          | "score"
          | "status"
          | "notes"
        > & {
          id?: string;
          source_platform?: string | null;
          score?: number | null;
          status?: MarketWatchlistStatus;
          notes?: string | null;
          created_at?: string;
        }
      >;
      operation_center: TableDef<
        OperationCenter,
        Omit<
          OperationCenter,
          | "id"
          | "created_at"
          | "updated_at"
          | "status"
          | "titulo"
          | "product_id"
          | "product_nome"
          | "ceo_session_id"
          | "smart_launch_session_id"
          | "copylab_id"
          | "assets_id"
          | "landing_id"
          | "orchestration_id"
          | "performance_report_id"
          | "steps"
          | "operational_score"
          | "success_chance"
          | "roi_previsto"
          | "next_steps"
          | "executive_logs"
          | "metadata"
        > & {
          id?: string;
          status?: OperationCenterStatus;
          titulo?: string;
          product_id?: string | null;
          product_nome?: string | null;
          ceo_session_id?: string | null;
          smart_launch_session_id?: string | null;
          copylab_id?: string | null;
          assets_id?: string | null;
          landing_id?: string | null;
          orchestration_id?: string | null;
          performance_report_id?: string | null;
          steps?: Json;
          operational_score?: number;
          success_chance?: number | null;
          roi_previsto?: number | null;
          next_steps?: Json;
          executive_logs?: Json;
          metadata?: Json;
          created_at?: string;
          updated_at?: string;
        }
      >;
    };
    Views: Record<string, never>;
    Functions: {
      seed_demo_data: { Args: Record<string, never>; Returns: undefined };
      mark_communication_opened: { Args: { p_token: string }; Returns: boolean };
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
  | "language_progress"
  | "language_sessions"
  | "language_lessons"
  | "notifications"
  | "aura_command_history"
  | "agent_history"
  | "communication_logs"
  | "user_xp"
  | "xp_history"
  | "system_logs"
  | "legacy_timeline"
  | "legacy_achievements"
  | "legacy_certificates"
  | "legacy_life_events"
  | "legacy_milestones"
  | "creator_products"
  | "creator_validation"
  | "creator_offers"
  | "creator_launches"
  | "creator_checklist_items"
  | "creator_research"
  | "creator_copylab"
  | "creator_assets"
  | "creator_landings"
  | "creator_ads_campaigns"
  | "creator_campaign_orchestrations"
  | "creator_launch_plans"
  | "execution_plans"
  | "execution_tasks"
  | "execution_history"
  | "performance_reports"
  | "performance_metrics"
  | "performance_insights"
  | "money_mission_plans"
  | "money_mission_tasks"
  | "aura_ceo_sessions"
  | "aura_smart_launch_sessions"
  | "autopilot_monitors"
  | "autopilot_actions"
  | "autopilot_logs"
  | "product_factory"
  | "product_files"
  | "product_versions"
  | "product_compliance_checks"
  | "creative_assets"
  | "ad_campaigns"
  | "landing_pages"
  | "funnels"
  | "offers"
  | "platform_connections"
  | "platform_sync_logs"
  | "affiliate_products"
  | "affiliate_analysis"
  | "global_markets"
  | "global_strategies"
  | "global_results"
  | "knowledge_entries"
  | "knowledge_insights"
  | "knowledge_patterns"
  | "market_history"
  | "meta_connections"
  | "meta_ad_accounts"
  | "meta_campaigns"
  | "meta_campaign_metrics"
  | "meta_metrics"
  | "meta_insights"
  | "meta_recommendations"
  | "kiwify_connections"
  | "kiwify_products"
  | "kiwify_sales"
  | "kiwify_commissions"
  | "platform_results"
  | "integration_action_logs"
  | "integration_connections"
  | "integration_sync_logs"
  | "integration_events"
  | "operation_center"
  | "growth_brain_memories"
  | "growth_patterns"
  | "revenue_metrics"
  | "revenue_forecasts"
  | "market_opportunities"
  | "market_watchlist";

export type AiModule =
  | "aura_central"
  | "mentor"
  | "agenda"
  | "saude"
  | "social"
  | "idiomas"
  | "legado"
  | "creator"
  | "execution"
  | "performance"
  | "autopilot";
