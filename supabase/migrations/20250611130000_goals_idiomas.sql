-- =============================================================================
-- Integração Aura English Coach com growth_goals
--
-- Metas de estudo de inglês ficam em language_progress (meta_diaria_min, streak,
-- aulas_concluidas, exercicios_concluidos, modulos_concluidos).
--
-- Este script sincroniza o XP ganho no módulo de idiomas na meta mensal de
-- crescimento (growth_goals.xp_total), alinhado aos valores do Aura XP:
--   aula concluída = 10 XP
--   exercício concluído = 5 XP
--   módulo completo = 20 XP
--
-- Requer: language_progress (20250611120000_language_module.sql)
--         growth_goals (20250602120000_growth_module.sql)
-- =============================================================================

create or replace function public.sync_growth_goals_on_language_progress()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_mes date := date_trunc('month', coalesce(new.ultima_pratica, current_date))::date;
  v_xp_delta integer := 0;
begin
  if new.aulas_concluidas > old.aulas_concluidas then
    v_xp_delta := v_xp_delta + (new.aulas_concluidas - old.aulas_concluidas) * 10;
  end if;

  if new.exercicios_concluidos > old.exercicios_concluidos then
    v_xp_delta := v_xp_delta + (new.exercicios_concluidos - old.exercicios_concluidos) * 5;
  end if;

  if new.modulos_concluidos > old.modulos_concluidos then
    v_xp_delta := v_xp_delta + (new.modulos_concluidos - old.modulos_concluidos) * 20;
  end if;

  if v_xp_delta > 0 then
    insert into public.growth_goals (
      user_id,
      mes_referencia,
      meta_receita_mensal,
      receita_atual,
      xp_total,
      nivel
    )
    values (new.user_id, v_mes, 0, 0, v_xp_delta, 1)
    on conflict (user_id, mes_referencia)
    do update set
      xp_total = public.growth_goals.xp_total + v_xp_delta,
      updated_at = now();
  end if;

  return new;
end;
$$;

drop trigger if exists language_progress_sync_growth_goals on public.language_progress;
create trigger language_progress_sync_growth_goals
  after update on public.language_progress
  for each row execute function public.sync_growth_goals_on_language_progress();
