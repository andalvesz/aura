import { UserXpRepository, XpHistoryRepository } from "@/lib/supabase/repositories/xp.repository";
import type { UserXp, XpAcao, XpHistory } from "@/types/database";
import {
  buildDailyMissionStatus,
  calculateLevel,
  getStreakDisplay,
  getXpProgress,
  isXpAcao,
  toIsoDate,
  XP_REWARDS,
  type XpProgress,
} from "@/utils/xp";
import { todayIsoDate } from "@/utils/health";
import { isMissingSupabaseTableError } from "@/utils/supabase-errors";
import { getDataContext, getOptionalDataContext } from "./context";

/** Fonte única de verdade: user_xp (total/nível) + xp_history (cada ganho). */

export type AuraXpState = {
  userXp: UserXp;
  progress: XpProgress;
  streakDisplay: string;
  recentAchievements: XpHistory[];
  dailyMissions: ReturnType<typeof buildDailyMissionStatus>;
};

function yesterdayIsoDate(reference = new Date()): string {
  const d = new Date(reference);
  d.setDate(d.getDate() - 1);
  return toIsoDate(d);
}

async function computeNextStreak(
  historyRepo: XpHistoryRepository,
  currentStreak: number
): Promise<number> {
  const today = todayIsoDate();
  const yesterday = yesterdayIsoDate();

  const [todayRes, yesterdayRes] = await Promise.all([
    historyRepo.hasActivityOnDate(today),
    historyRepo.hasActivityOnDate(yesterday),
  ]);

  if (todayRes.data) {
    return currentStreak;
  }

  if (yesterdayRes.data) {
    return currentStreak + 1;
  }

  return 1;
}

export async function getAuraXpState(): Promise<{
  state: AuraXpState | null;
  error: string | null;
}> {
  const ctx = await getOptionalDataContext();
  if (!ctx) {
    return { state: null, error: "Usuário não autenticado." };
  }

  const userXpRepo = new UserXpRepository(ctx.supabase, ctx.userId);
  const historyRepo = new XpHistoryRepository(ctx.supabase, ctx.userId);

  const [userXpRes, historyRes, todayHistoryRes] = await Promise.all([
    userXpRepo.ensureRow(),
    historyRepo.findRecent(5),
    historyRepo.findSince(todayIsoDate()),
  ]);

  if (userXpRes.error && !isMissingSupabaseTableError(userXpRes.error)) {
    return { state: null, error: userXpRes.error };
  }
  if (historyRes.error && !isMissingSupabaseTableError(historyRes.error)) {
    return { state: null, error: historyRes.error };
  }
  if (todayHistoryRes.error && !isMissingSupabaseTableError(todayHistoryRes.error)) {
    return { state: null, error: todayHistoryRes.error };
  }

  const userXp =
    userXpRes.data ??
    ({
      id: "",
      user_id: ctx.userId,
      xp_total: 0,
      nivel: 1,
      streak_dias: 0,
      created_at: new Date().toISOString(),
    } satisfies UserXp);

  const progress = getXpProgress(userXp.xp_total);

  return {
    state: {
      userXp,
      progress,
      streakDisplay: getStreakDisplay(userXp.streak_dias),
      recentAchievements: historyRes.data ?? [],
      dailyMissions: buildDailyMissionStatus(todayHistoryRes.data ?? []),
    },
    error: null,
  };
}

export async function awardAuraXp(acao: XpAcao): Promise<{
  awarded: boolean;
  xp: number;
  state: AuraXpState | null;
  error: string | null;
}> {
  if (!isXpAcao(acao)) {
    return { awarded: false, xp: 0, state: null, error: "Ação de XP inválida." };
  }

  const xp = XP_REWARDS[acao];

  try {
    const { supabase, userId } = await getDataContext();
    const userXpRepo = new UserXpRepository(supabase, userId);
    const historyRepo = new XpHistoryRepository(supabase, userId);

    const ensured = await userXpRepo.ensureRow();
    if (ensured.error || !ensured.data) {
      return { awarded: false, xp: 0, state: null, error: ensured.error ?? "Erro ao carregar XP." };
    }

    const nextStreak = await computeNextStreak(historyRepo, ensured.data.streak_dias);
    const newXpTotal = ensured.data.xp_total + xp;
    const newLevel = calculateLevel(newXpTotal);

    const { error: historyError } = await historyRepo.create({ acao, xp });
    if (historyError) {
      return { awarded: false, xp: 0, state: null, error: historyError };
    }

    const { data: updated, error: updateError } = await userXpRepo.update(ensured.data.id, {
      xp_total: newXpTotal,
      nivel: newLevel,
      streak_dias: nextStreak,
    });

    if (updateError || !updated) {
      return { awarded: false, xp: 0, state: null, error: updateError ?? "Erro ao atualizar XP." };
    }

    const { state } = await getAuraXpState();
    return { awarded: true, xp, state, error: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao conceder XP.";
    if (isMissingSupabaseTableError(message)) {
      return { awarded: false, xp: 0, state: null, error: null };
    }
    return { awarded: false, xp: 0, state: null, error: message };
  }
}
