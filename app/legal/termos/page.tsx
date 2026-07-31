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

export default function TermosPage() {
  return (
    <Preliminary title="Termos de uso (preliminar)">
      <p>
        O Aura Brain é oferecido em beta privada. O serviço pode mudar, pausar ou
        apresentar erros. Você é responsável pelo conteúdo que envia.
      </p>
      <p>
        Não use o produto para atividades ilegais. Autonomia elevada (AUTO_SAFE) não
        é ativada automaticamente no onboarding.
      </p>
    </Preliminary>
  );
}
