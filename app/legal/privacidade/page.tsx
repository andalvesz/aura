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

export default function PrivacidadeLegalPage() {
  return (
    <Preliminary title="Política de privacidade (preliminar)">
      <p>
        Dados de conta, workspaces, memórias e documentos são armazenados no Supabase
        com RLS. Você pode exportar configurações e solicitar exclusão com período de
        revisão no Privacy Center.
      </p>
      <p>
        Analytics não essenciais podem ser desativados. Secrets e tokens não entram em
        exports.
      </p>
    </Preliminary>
  );
}
