import { redirect } from "next/navigation";

/**
 * Consórcios foi removido do Aura OS 2.0.
 * Mantém a rota apenas como redirect para não quebrar bookmarks.
 */
export default function ConsorciosPage() {
  redirect("/dashboard/crescimento");
}
