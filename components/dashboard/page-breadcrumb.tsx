import Link from "next/link";

export function PageBreadcrumb({
  items,
}: {
  items: Array<{ label: string; href?: string }>;
}) {
  return (
    <nav
      aria-label="Breadcrumb"
      className="flex flex-wrap items-center gap-1 text-[11px] text-zinc-600"
      data-testid="page-breadcrumb"
    >
      {items.map((item, i) => (
        <span key={`${item.label}-${i}`} className="flex items-center gap-1">
          {i > 0 ? <span aria-hidden>/</span> : null}
          {item.href ? (
            <Link href={item.href} className="hover:text-zinc-300">
              {item.label}
            </Link>
          ) : (
            <span className="text-zinc-400">{item.label}</span>
          )}
        </span>
      ))}
      <Link
        href="/dashboard"
        className="ml-auto text-zinc-500 hover:text-zinc-300"
      >
        ← Voltar
      </Link>
    </nav>
  );
}
