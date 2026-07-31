function Preliminary({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <main className="mx-auto max-w-2xl space-y-4 p-6 text-zinc-200">
      <p className="rounded border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-[12px] text-amber-200/90">
        Documento preliminar para revisão jurídica. Não inventa conformidade legal.
      </p>
      <h1 className="text-xl font-medium">{title}</h1>
      <div className="space-y-3 text-[14px] leading-relaxed text-zinc-400">{children}</div>
    </main>
  );
}

export default function BetaLimitsPage() {
  return (
    <Preliminary title="Limites da beta (preliminar)">
      <p>
        Acesso por convite / status ACTIVE. Sem marketplace público. Sem pagamentos
        nesta fase. Recursos podem ser pausados por feature flags. Erros isolados não
        devem derrubar toda a Home, mas a estabilidade ainda evolui.
      </p>
    </Preliminary>
  );
}
