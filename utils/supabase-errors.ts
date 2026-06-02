/** Erros do PostgREST quando a tabela não existe no projeto Supabase. */
export function isMissingSupabaseTableError(message: string | null | undefined): boolean {
  if (!message) return false;

  const lower = message.toLowerCase();

  if (lower.includes("could not find the table") || lower.includes("schema cache")) {
    return true;
  }

  if (lower.includes("relation") && lower.includes("does not exist")) {
    return true;
  }

  return /public\.(clients|events|budgets|clientes|eventos|orcamentos|estoque)\b/.test(
    lower
  );
}
