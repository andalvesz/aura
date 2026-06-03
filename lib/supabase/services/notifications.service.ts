import {
  BaseRepository,
  ConteudosRepository,
  NotificationsRepository,
  OrcamentosRepository,
} from "@/lib/supabase/repositories";
import { GrowthLeadsRepository, GrowthMissionsRepository } from "@/lib/supabase/repositories/growth.repository";
import { listClientes } from "@/lib/supabase/services/alvesz.service";
import { listEventos } from "@/lib/supabase/services/eventos.service";
import type {
  Conteudo,
  Evento,
  FinancialGoal,
  Gasto,
  GrowthLead,
  GrowthMission,
  HealthWorkout,
  Notification,
  Orcamento,
} from "@/types/database";
import {
  buildNotificationCandidates,
  notificationMatchesCandidate,
} from "@/utils/notifications";
import { isMissingSupabaseTableError } from "@/utils/supabase-errors";
import { getOptionalDataContext } from "./context";

async function safeLoad<T>(
  loader: () => Promise<{ data: T | null; error: string | null }>,
  fallback: T
): Promise<T> {
  try {
    const { data, error } = await loader();
    if (error && !isMissingSupabaseTableError(error)) {
      console.warn("[notifications] Erro ao carregar dados:", error);
    }
    return data ?? fallback;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (!isMissingSupabaseTableError(message)) {
      console.warn("[notifications] Exceção ao carregar dados:", message);
    }
    return fallback;
  }
}

export async function listNotifications(): Promise<{
  notifications: Notification[];
  error: string | null;
}> {
  const ctx = await getOptionalDataContext();
  if (!ctx) {
    return { notifications: [], error: "Usuário não autenticado." };
  }

  const repo = new NotificationsRepository(ctx.supabase, ctx.userId);
  const { data, error } = await repo.findAllOrdered();

  if (error && isMissingSupabaseTableError(error)) {
    return { notifications: [], error: null };
  }

  return { notifications: data ?? [], error };
}

export async function syncNotifications(): Promise<{
  created: number;
  error: string | null;
}> {
  const ctx = await getOptionalDataContext();
  if (!ctx) {
    return { created: 0, error: "Usuário não autenticado." };
  }

  const { supabase, userId } = ctx;
  const notificationsRepo = new NotificationsRepository(supabase, userId);

  const [
    leads,
    eventos,
    missions,
    conteudos,
    workouts,
    orcamentos,
    clientes,
    gastos,
    financialGoals,
    existing,
  ] = await Promise.all([
      safeLoad(
        () => new GrowthLeadsRepository(supabase, userId).findAll(),
        [] as GrowthLead[]
      ),
      safeLoad(() => listEventos(), [] as Evento[]),
      safeLoad(
        () => new GrowthMissionsRepository(supabase, userId).findAll("mission_date"),
        [] as GrowthMission[]
      ),
      safeLoad(
        () => new ConteudosRepository(supabase, userId).findAll(),
        [] as Conteudo[]
      ),
      safeLoad(
        () =>
          new BaseRepository(supabase, "health_workouts", userId).findAll("data"),
        [] as HealthWorkout[]
      ),
      safeLoad(
        () => new OrcamentosRepository(supabase, userId).findAll(),
        [] as Orcamento[]
      ),
      safeLoad(async () => {
        const { data, error } = await listClientes();
        return { data: data ?? [], error };
      }, []),
      safeLoad(
        () => new BaseRepository(supabase, "gastos", userId).findAll("data"),
        [] as Gasto[]
      ),
      safeLoad(
        () => new BaseRepository(supabase, "financial_goals", userId).findAll("data_fim"),
        [] as FinancialGoal[]
      ),
      notificationsRepo.findAllOrdered(),
    ]);

  if (existing.error && isMissingSupabaseTableError(existing.error)) {
    return { created: 0, error: null };
  }

  const candidates = buildNotificationCandidates({
    leads,
    eventos,
    missions,
    conteudos,
    workouts,
    orcamentos,
    clientes,
    gastos,
    financialGoals,
  });

  const unreadExisting = (existing.data ?? []).filter((n) => n.status === "unread");
  let created = 0;

  for (const candidate of candidates) {
    const duplicate = unreadExisting.some((n) =>
      notificationMatchesCandidate(n, candidate)
    );
    if (duplicate) continue;

    const { error } = await notificationsRepo.create({
      title: candidate.title,
      message: candidate.message,
      type: candidate.type,
      status: "unread",
      related_module: candidate.related_module,
      related_id: candidate.related_id,
      scheduled_for: candidate.scheduled_for,
      read_at: null,
    });

    if (!error) created += 1;
  }

  return { created, error: null };
}

export async function markNotificationRead(id: string): Promise<{
  notification: Notification | null;
  error: string | null;
}> {
  const ctx = await getOptionalDataContext();
  if (!ctx) {
    return { notification: null, error: "Usuário não autenticado." };
  }

  const { data, error } = await new NotificationsRepository(
    ctx.supabase,
    ctx.userId
  ).markAsRead(id);

  return { notification: data, error };
}

export async function deleteNotification(id: string): Promise<{ error: string | null }> {
  const ctx = await getOptionalDataContext();
  if (!ctx) {
    return { error: "Usuário não autenticado." };
  }

  const { error } = await new NotificationsRepository(ctx.supabase, ctx.userId).delete(
    id
  );

  return { error };
}

export async function markAllNotificationsRead(): Promise<{ error: string | null }> {
  const ctx = await getOptionalDataContext();
  if (!ctx) {
    return { error: "Usuário não autenticado." };
  }

  const { error } = await new NotificationsRepository(
    ctx.supabase,
    ctx.userId
  ).markAllAsRead();

  return { error };
}
