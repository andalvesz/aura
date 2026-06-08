"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { parseJsonResponse } from "@/utils/safe-json";
import type { LegacyData } from "@/utils/legado";
import { useSupabaseCrud } from "./use-supabase-crud";

export function useLegacy() {
  const timeline = useSupabaseCrud<"legacy_timeline">({
    table: "legacy_timeline",
    orderBy: "ano",
    ascending: false,
  });
  const achievements = useSupabaseCrud<"legacy_achievements">({
    table: "legacy_achievements",
    orderBy: "ano",
    ascending: false,
  });
  const certificates = useSupabaseCrud<"legacy_certificates">({
    table: "legacy_certificates",
    orderBy: "ano",
    ascending: false,
  });
  const lifeEvents = useSupabaseCrud<"legacy_life_events">({
    table: "legacy_life_events",
    orderBy: "data_evento",
    ascending: false,
  });
  const milestones = useSupabaseCrud<"legacy_milestones">({
    table: "legacy_milestones",
    orderBy: "data_marco",
    ascending: false,
  });

  const [seeding, setSeeding] = useState(false);
  const [seedError, setSeedError] = useState<string | null>(null);

  const loading =
    timeline.loading ||
    achievements.loading ||
    certificates.loading ||
    lifeEvents.loading ||
    milestones.loading;

  const error =
    timeline.error ??
    achievements.error ??
    certificates.error ??
    lifeEvents.error ??
    milestones.error ??
    seedError;

  const data: LegacyData = useMemo(
    () => ({
      timeline: timeline.data,
      achievements: achievements.data,
      certificates: certificates.data,
      lifeEvents: lifeEvents.data,
      milestones: milestones.data,
    }),
    [
      timeline.data,
      achievements.data,
      certificates.data,
      lifeEvents.data,
      milestones.data,
    ]
  );

  const refresh = useCallback(async () => {
    await Promise.all([
      timeline.refresh(),
      achievements.refresh(),
      certificates.refresh(),
      lifeEvents.refresh(),
      milestones.refresh(),
    ]);
  }, [timeline, achievements, certificates, lifeEvents, milestones]);

  const seedInitial = useCallback(async () => {
    setSeeding(true);
    setSeedError(null);
    try {
      const res = await fetch("/api/legado/seed", { method: "POST" });
      const { data: body, error: parseError } = await parseJsonResponse<{
        seeded?: boolean;
        error?: string;
      }>(res);
      if (parseError || !res.ok) {
        setSeedError(body?.error ?? parseError ?? "Erro ao importar legado.");
        return { error: body?.error ?? parseError };
      }
      await refresh();
      return { error: null, seeded: body?.seeded };
    } catch {
      const msg = "Erro de conexão ao importar legado.";
      setSeedError(msg);
      return { error: msg };
    } finally {
      setSeeding(false);
    }
  }, [refresh]);

  return {
    data,
    loading,
    error,
    seeding,
    refresh,
    seedInitial,
    timeline,
    achievements,
    certificates,
    lifeEvents,
    milestones,
    empty: data.timeline.length === 0 && data.achievements.length === 0,
  };
}
