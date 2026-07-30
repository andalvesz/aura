import Link from "next/link";

export default function NotFound() {
  return (
    <main
      className="flex min-h-[70vh] items-center justify-center px-6 py-16"
      data-testid="not-found-page"
    >
      <div className="w-full max-w-md space-y-4 text-center">
        <p className="text-[11px] uppercase tracking-[0.2em] text-zinc-500">
          404
        </p>
        <h1 className="text-2xl font-medium text-zinc-100">Página não encontrada</h1>
        <p className="text-[14px] text-zinc-400">
          O endereço não existe ou você não tem acesso a este recurso.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
          <Link
            href="/dashboard"
            className="inline-flex min-h-11 items-center rounded-md bg-cyan-500/90 px-4 text-[13px] font-medium text-zinc-950"
          >
            Ir ao dashboard
          </Link>
          <Link
            href="/"
            className="inline-flex min-h-11 items-center rounded-md border border-white/10 px-4 text-[13px] text-zinc-300"
          >
            Início
          </Link>
        </div>
      </div>
    </main>
  );
}
