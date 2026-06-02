import { isDevelopmentEnv } from "@/lib/dev/is-development";
import { createClient } from "@/lib/supabase/server";
import {
  isResetCountsEmpty,
  RESET_TEST_DATA_COUNT_SOURCES,
  RESET_TEST_DATA_TABLES,
  type ResetTestDataCounts,
} from "@/utils/reset-test-data";

type CountQuery = {
  select: (
    columns: string,
    options: { count: "exact"; head: true }
  ) => {
    eq: (
      column: string,
      value: string
    ) => Promise<{ count: number | null; error: { message: string } | null }>;
  };
};

type DeleteQuery = {
  delete: () => {
    eq: (
      column: string,
      value: string
    ) => Promise<{ error: { message: string } | null }>;
  };
};

async function countForUser(
  supabase: Awaited<ReturnType<typeof createClient>>,
  table: string,
  userId: string
): Promise<number> {
  const { count, error } = await (supabase.from(table) as unknown as CountQuery)
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId);
  if (error) throw new Error(`${table}: ${error.message}`);
  return count ?? 0;
}

async function deleteForUser(
  supabase: Awaited<ReturnType<typeof createClient>>,
  table: string,
  userId: string
): Promise<void> {
  const { error } = await (supabase.from(table) as unknown as DeleteQuery)
    .delete()
    .eq("user_id", userId);
  if (error) throw new Error(`${table}: ${error.message}`);
}

async function loadCounts(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string
): Promise<ResetTestDataCounts> {
  const counts = {} as ResetTestDataCounts;
  for (const { key, table } of RESET_TEST_DATA_COUNT_SOURCES) {
    counts[key] = await countForUser(supabase, table, userId);
  }
  return counts;
}

export async function POST() {
  if (!isDevelopmentEnv()) {
    return Response.json({ error: "Disponível apenas em desenvolvimento." }, { status: 403 });
  }

  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return Response.json({ error: "Não autenticado." }, { status: 401 });
  }

  try {
    for (const table of RESET_TEST_DATA_TABLES) {
      await deleteForUser(supabase, table, user.id);
    }

    const counts = await loadCounts(supabase, user.id);

    if (!isResetCountsEmpty(counts)) {
      return Response.json(
        {
          error: "Alguns registros não foram removidos.",
          counts,
        },
        { status: 500 }
      );
    }

    return Response.json({ ok: true, counts });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao limpar dados.";
    console.error("[reset-test-data]", error);
    return Response.json({ error: message }, { status: 500 });
  }
}
