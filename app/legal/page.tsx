import Link from "next/link";

const DOCS = [
  {
    href: "/legal/termos",
    title: "Termos de uso",
    note: "Documento preliminar — revisão jurídica pendente",
  },
  {
    href: "/legal/privacidade",
    title: "Política de privacidade",
    note: "Documento preliminar — revisão jurídica pendente",
  },
  {
    href: "/legal/ia",
    title: "Política de IA",
    note: "Documento preliminar — revisão jurídica pendente",
  },
  {
    href: "/legal/dados",
    title: "Política de dados",
    note: "Documento preliminar — revisão jurídica pendente",
  },
  {
    href: "/legal/beta",
    title: "Limites da beta",
    note: "Documento preliminar — revisão jurídica pendente",
  },
] as const;

export default function LegalIndexPage() {
  return (
    <main className="mx-auto max-w-xl space-y-4 p-6 text-zinc-200">
      <h1 className="text-xl font-medium">Documentos legais (preliminares)</h1>
      <p className="text-sm text-zinc-500">
        Estes textos são fundação editável para revisão jurídica. Não constituem
        conformidade legal garantida.
      </p>
      <ul className="space-y-2">
        {DOCS.map((d) => (
          <li key={d.href}>
            <Link href={d.href} className="text-cyan-400 underline">
              {d.title}
            </Link>
            <p className="text-xs text-amber-500/80">{d.note}</p>
          </li>
        ))}
      </ul>
    </main>
  );
}
