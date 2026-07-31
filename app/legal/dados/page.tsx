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

export default function DadosPolicyPage() {
  return (
    <Preliminary title="Política de dados (preliminar)">
      <p>
        Isolamento por usuário e workspace via RLS. Skills privadas (ex.: Alvesz) não
        são exportadas publicamente. Retenção e backups dependem da configuração
        operacional documentada — sem promessa automática se não estiver configurado.
      </p>
    </Preliminary>
  );
}
