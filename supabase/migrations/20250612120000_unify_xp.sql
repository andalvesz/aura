-- =============================================================================
-- Unificação do sistema de XP
-- user_xp + xp_history são a fonte única de verdade.
-- growth_goals.xp_total permanece na tabela (receita mensal) mas não recebe XP.
-- =============================================================================

-- Idiomas: XP já é concedido via language.service → awardAuraXp → user_xp.
-- Remove trigger legado que duplicava XP em growth_goals.xp_total.
drop trigger if exists language_progress_sync_growth_goals on public.language_progress;
drop function if exists public.sync_growth_goals_on_language_progress();
