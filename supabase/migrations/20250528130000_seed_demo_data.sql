-- Aura — função seed_demo_data() com dados demo realistas
-- Executar após migrations de módulos. Uso: select public.seed_demo_data();

create or replace function public.seed_demo_data()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_mes_inicio date := date_trunc('month', current_date)::date;
begin
  if v_user_id is null then
    raise exception 'Autenticação necessária para seed_demo_data';
  end if;

  -- Idempotente: não duplica se já existir seed para este usuário
  if exists (select 1 from public.gastos where user_id = v_user_id limit 1) then
    return;
  end if;

  -- -------------------------------------------------------------------------
  -- Gastos (Financeiro)
  -- -------------------------------------------------------------------------
  insert into public.gastos (user_id, titulo, valor, categoria, data) values
    (v_user_id, 'iFood — almoço', 42.90, 'alimentacao', current_date),
    (v_user_id, 'Uber trabalho', 28.50, 'transporte', current_date),
    (v_user_id, 'Mercado Semanal', 287.40, 'alimentacao', current_date - 1),
    (v_user_id, 'Spotify', 27.90, 'lazer', current_date - 1),
    (v_user_id, 'Adobe Creative Cloud', 119.00, 'trabalho', current_date - 2),
    (v_user_id, 'Farmácia', 67.40, 'saude', current_date - 2),
    (v_user_id, 'Posto Shell', 220.00, 'transporte', current_date - 3),
    (v_user_id, 'Academia mensalidade', 149.90, 'saude', current_date - 5),
    (v_user_id, 'Restaurante jantar', 156.00, 'alimentacao', current_date - 6),
    (v_user_id, 'Assinatura Notion', 48.00, 'trabalho', v_mes_inicio + 2),
    (v_user_id, 'Cinema', 64.00, 'lazer', v_mes_inicio + 4),
    (v_user_id, 'Manutenção carro', 380.00, 'transporte', v_mes_inicio + 8),
    (v_user_id, 'Presente aniversário', 120.00, 'outros', v_mes_inicio + 10);

  -- -------------------------------------------------------------------------
  -- Eventos (Calendário)
  -- -------------------------------------------------------------------------
  insert into public.eventos (user_id, titulo, descricao, data_inicio, data_fim, local, tipo) values
    (
      v_user_id,
      'Reunião com cliente — Alvesz',
      'Apresentação de pacote Premium Open Bar',
      (current_date + 1 + time '15:00')::timestamptz,
      (current_date + 1 + time '16:00')::timestamptz,
      'Google Meet',
      'trabalho'
    ),
    (
      v_user_id,
      'Treino — pernas e core',
      null,
      (current_date + 2 + time '07:00')::timestamptz,
      (current_date + 2 + time '08:00')::timestamptz,
      'Smart Fit',
      'saude'
    ),
    (
      v_user_id,
      'Gravação Reels Alvesz',
      'Bastidores montagem de bar',
      (current_date + 3 + time '18:30')::timestamptz,
      (current_date + 3 + time '20:00')::timestamptz,
      'Estúdio casa',
      'social'
    ),
    (
      v_user_id,
      'Follow-up leads consórcio',
      'Retornar 3 leads quentes da semana',
      (current_date + 4 + time '10:00')::timestamptz,
      (current_date + 4 + time '11:30')::timestamptz,
      null,
      'vendas'
    ),
    (
      v_user_id,
      'Evento corporativo Tech Ltda',
      'Operação completa — 80 convidados',
      (current_date + 12 + time '19:00')::timestamptz,
      (current_date + 12 + time '23:30')::timestamptz,
      'Espaço Vila Madalena',
      'trabalho'
    ),
    (
      v_user_id,
      'Meditação guiada',
      'Sessão 15 min — app Calm',
      (current_date + time '06:30')::timestamptz,
      (current_date + time '06:45')::timestamptz,
      'Casa',
      'saude'
    );

  -- -------------------------------------------------------------------------
  -- Clientes (Alvesz) — CTE para IDs nos orçamentos
  -- -------------------------------------------------------------------------
  with novos_clientes as (
    insert into public.clientes (user_id, nome, telefone, email, tipo, observacoes)
    values
      (v_user_id, 'Maria Silva', '11999990001', 'maria.silva@email.com', 'pessoa_fisica', 'Casamento em dezembro — 120 convidados'),
      (v_user_id, 'Tech Solutions Ltda', '1133334444', 'eventos@techsolutions.com', 'empresa', 'Evento corporativo trimestral'),
      (v_user_id, 'João & Paula', '11988887777', 'joaoepaula@gmail.com', 'pessoa_fisica', 'Aniversário 15 anos — tema neon'),
      (v_user_id, 'Clube Náutico SP', '1144445555', 'reservas@clubenautico.com.br', 'empresa', 'Sunset cocktail mensal')
    returning id, nome
  )
  insert into public.orcamentos (
    user_id, cliente_id, tipo_evento, convidados, valor_total, lucro_estimado, status
  )
  select
    v_user_id,
    c.id,
    o.tipo_evento,
    o.convidados,
    o.valor_total,
    o.lucro_estimado,
    o.status
  from novos_clientes c
  join (
    values
      ('Maria Silva', 'Premium Open Bar', 120, 12500.00, 4750.00, 'pendente'),
      ('Tech Solutions Ltda', 'Corporate Experience', 80, 8900.00, 3382.00, 'aprovado'),
      ('João & Paula', 'Festa Teen Premium', 60, 6200.00, 2356.00, 'rascunho'),
      ('Clube Náutico SP', 'Sunset Cocktail', 45, 4800.00, 1824.00, 'pendente')
  ) as o(nome_cliente, tipo_evento, convidados, valor_total, lucro_estimado, status)
    on o.nome_cliente = c.nome;

  -- -------------------------------------------------------------------------
  -- Estoque (Alvesz)
  -- -------------------------------------------------------------------------
  insert into public.estoque (user_id, produto, quantidade, unidade, minimo_alerta) values
    (v_user_id, 'Vodka Absolut', 8, 'garrafas', 3),
    (v_user_id, 'Gin Tanqueray', 3, 'garrafas', 5),
    (v_user_id, 'Whisky', 5, 'garrafas', 4),
    (v_user_id, 'Limão', 12, 'kg', 4),
    (v_user_id, 'Gengibre', 3, 'kg', 2),
    (v_user_id, 'Copos descartáveis', 240, 'un', 100),
    (v_user_id, 'Canudos biodegradáveis', 500, 'un', 150),
    (v_user_id, 'Gelo', 2, 'bags', 5),
    (v_user_id, 'Água com gás', 48, 'un', 24),
    (v_user_id, 'Xarope grenadine', 6, 'un', 3);

  -- -------------------------------------------------------------------------
  -- Treinos (Saúde)
  -- -------------------------------------------------------------------------
  insert into public.treinos (user_id, titulo, categoria, exercicios) values
    (
      v_user_id,
      'Pernas + Core',
      'forca',
      '[
        {"nome":"Agachamento livre","series":4,"reps":10},
        {"nome":"Leg press","series":3,"reps":12},
        {"nome":"Stiff","series":3,"reps":10},
        {"nome":"Prancha frontal","series":3,"reps":"45s"}
      ]'::jsonb
    ),
    (
      v_user_id,
      'Superiores',
      'forca',
      '[
        {"nome":"Supino reto","series":4,"reps":8},
        {"nome":"Remada curvada","series":3,"reps":10},
        {"nome":"Desenvolvimento halteres","series":3,"reps":12},
        {"nome":"Tríceps corda","series":3,"reps":15}
      ]'::jsonb
    ),
    (
      v_user_id,
      'Cardio HIIT',
      'cardio',
      '[
        {"nome":"Esteira — aquecimento","series":1,"reps":"10 min"},
        {"nome":"Sprint intervalado","series":8,"reps":"30s"},
        {"nome":"Bike — resfriamento","series":1,"reps":"5 min"}
      ]'::jsonb
    );

  -- -------------------------------------------------------------------------
  -- Dieta (Saúde)
  -- -------------------------------------------------------------------------
  insert into public.dieta (user_id, refeicao, horario, calorias) values
    (v_user_id, 'Café da manhã', '07:00', 420),
    (v_user_id, 'Lanche manhã', '10:30', 180),
    (v_user_id, 'Almoço', '12:30', 650),
    (v_user_id, 'Pré-treino', '16:30', 220),
    (v_user_id, 'Jantar', '19:30', 520),
    (v_user_id, 'Ceia leve', '21:30', 150);

  -- -------------------------------------------------------------------------
  -- Conteúdos (Social Media)
  -- -------------------------------------------------------------------------
  insert into public.conteudos (user_id, plataforma, titulo, status, data_publicacao) values
    (v_user_id, 'instagram', '5 erros ao montar bar em eventos', 'planejado', (current_date + 2 + time '12:00')::timestamptz),
    (v_user_id, 'instagram', 'POV: montando open bar em 60 min', 'ideia', null),
    (v_user_id, 'youtube', 'Bastidores Alvesz Experience — case completo', 'planejado', (current_date + 5 + time '18:00')::timestamptz),
    (v_user_id, 'youtube', 'Quanto custa um evento premium?', 'ideia', null),
    (v_user_id, 'tiktok', 'Como precificar open bar em 2025', 'publicado', (current_date - 3 + time '20:00')::timestamptz),
    (v_user_id, 'tiktok', 'Drink do evento que viralizou', 'publicado', (current_date - 1 + time '19:30')::timestamptz),
    (v_user_id, 'facebook', 'Depoimento Maria Silva — casamento', 'analise', null),
    (v_user_id, 'facebook', 'Promoção pacote corporativo Q2', 'planejado', (current_date + 7 + time '10:00')::timestamptz);

  -- -------------------------------------------------------------------------
  -- Leads (Consórcios) — pipeline: novo, contato, proposta, fechado
  -- -------------------------------------------------------------------------
  insert into public.leads (user_id, nome, telefone, origem, status, observacoes) values
    (v_user_id, 'Carlos Mendes', '11966665555', 'site', 'novo', 'Preencheu formulário hoje — carta R$ 120k'),
    (v_user_id, 'Fernanda Lima', '11955554444', 'instagram', 'novo', 'DM pedindo simulação'),
    (v_user_id, 'João Pereira', '11988887777', 'indicacao', 'contato', 'Indicação Maria — interesse imóvel R$ 150k'),
    (v_user_id, 'Patrícia Souza', '11944443333', 'whatsapp', 'contato', 'Aguardando retorno ligação'),
    (v_user_id, 'Ana Rocha', '11977776666', 'instagram', 'proposta', 'Proposta enviada — documentos recebidos'),
    (v_user_id, 'Ricardo Almeida', '11933332222', 'indicacao', 'proposta', 'Analisando parcelas — carta R$ 200k'),
    (v_user_id, 'Beatriz Costa', '11922221111', 'site', 'fechado', 'Fechou carta R$ 80k — comissão confirmada'),
    (v_user_id, 'Marcos Oliveira', '11911110000', 'facebook', 'fechado', 'Fechou em março — upsell automóvel');

end;
$$;

grant execute on function public.seed_demo_data() to authenticated;

comment on function public.seed_demo_data() is
  'Popula dados demo do Aura para auth.uid(). Idempotente por usuário.';
