"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { LanguageProgress } from "@/types/database";

export function useLanguageProgress() {
  const supabase = useMemo(() => createClient(), []);
  const [data, setData] = useState<LanguageProgress | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setData(null);
      setLoading(false);
      setError("Usuário não autenticado.");
      return;
    }

    const { data: row, error: fetchError } = await supabase
      .from("language_progress")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    if (fetchError) {
      setLoading(false);
      setError(fetchError.message);
      return;
    }

    if (!row) {
      const { data: created, error: createError } = await supabase
        .from("language_progress")
        .insert({ user_id: user.id })
        .select()
        .single();

      setLoading(false);
      if (createError) {
        setError(createError.message);
        return;
      }
      setData(created as LanguageProgress);
      return;
    }

    setData(row as LanguageProgress);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const update = useCallback(
    async (patch: Partial<LanguageProgress>) => {
      if (!data) return { error: "Progresso não carregado." };

      const { data: updated, error: updateError } = await supabase
        .from("language_progress")
        .update(patch)
        .eq("id", data.id)
        .select()
        .single();

      if (updateError) return { error: updateError.message };

      setData(updated as LanguageProgress);
      return { error: null };
    },
    [supabase, data]
  );

  return { data, loading, error, refresh, update };
}
