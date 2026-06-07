"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { TripChecklistItem } from "@/types/database";

export function useTripChecklist(tripId: string | null) {
  const supabase = useMemo(() => createClient(), []);
  const [data, setData] = useState<TripChecklistItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!tripId) {
      setData([]);
      return;
    }

    setLoading(true);
    setError(null);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setData([]);
      setLoading(false);
      setError("Usuário não autenticado.");
      return;
    }

    const { data: rows, error: fetchError } = await supabase
      .from("trip_checklist_items")
      .select("*")
      .eq("user_id", user.id)
      .eq("trip_id", tripId)
      .order("ordem", { ascending: true });

    setLoading(false);

    if (fetchError) {
      setError(fetchError.message);
      return;
    }

    setData((rows as TripChecklistItem[]) ?? []);
  }, [supabase, tripId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const update = useCallback(
    async (id: string, status: TripChecklistItem["status"]) => {
      const { data: row, error: updateError } = await supabase
        .from("trip_checklist_items")
        .update({ status })
        .eq("id", id)
        .select()
        .single();

      if (updateError) return { data: null, error: updateError.message };

      setData((prev) =>
        prev.map((item) => (item.id === id ? (row as TripChecklistItem) : item))
      );
      return { data: row as TripChecklistItem, error: null };
    },
    [supabase]
  );

  const create = useCallback(
    async (payload: {
      categoria: TripChecklistItem["categoria"];
      titulo: string;
    }) => {
      if (!tripId) return { data: null, error: "Selecione uma viagem." };

      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return { data: null, error: "Usuário não autenticado." };

      const ordem = data.length;
      const { data: row, error: insertError } = await supabase
        .from("trip_checklist_items")
        .insert({
          user_id: user.id,
          trip_id: tripId,
          categoria: payload.categoria,
          titulo: payload.titulo,
          status: "pendente",
          ordem,
        })
        .select()
        .single();

      if (insertError) return { data: null, error: insertError.message };

      setData((prev) => [...prev, row as TripChecklistItem]);
      return { data: row as TripChecklistItem, error: null };
    },
    [supabase, tripId, data.length]
  );

  return { data, loading, error, refresh, update, create };
}
