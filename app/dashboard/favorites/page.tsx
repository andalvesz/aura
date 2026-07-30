import Link from "next/link";
import { listFavorites } from "@/lib/supabase/services/daily-ops.service";
import { PageBreadcrumb } from "@/components/dashboard/page-breadcrumb";
import { EmptyState } from "@/components/dashboard/empty-state";
import { FavoritesClient } from "@/components/dashboard/daily/favorites-client";

export default async function FavoritesPage() {
  const items = await listFavorites();

  return (
    <div className="mx-auto max-w-2xl space-y-4" data-testid="favorites-page">
      <PageBreadcrumb
        items={[
          { label: "Meu Dia", href: "/dashboard" },
          { label: "Favoritos" },
        ]}
      />
      <div>
        <h1 className="text-lg font-medium text-zinc-100">Favoritos</h1>
        <p className="text-[12px] text-zinc-500">
          Memórias, entidades, projetos, descobertas e documentos marcados.
        </p>
      </div>
      {!items.length ? (
        <EmptyState
          title="Nenhum favorito"
          description="Favorite itens nas telas de Memória, Discovery ou Mapa para encontrá-los rápido."
          action={
            <Link
              href="/dashboard/discovery"
              className="text-[12px] text-cyan-400 hover:underline"
            >
              Abrir Descobertas
            </Link>
          }
        />
      ) : (
        <FavoritesClient items={items} />
      )}
    </div>
  );
}
