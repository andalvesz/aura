import Link from "next/link";
import { AcceptInviteForm } from "@/components/auth/accept-invite-form";
import { getUser } from "@/lib/auth";

type PageProps = {
  params: Promise<{ token: string }>;
};

export default async function ConvitePage({ params }: PageProps) {
  const { token } = await params;
  const user = await getUser();

  return (
    <main className="flex min-h-[100dvh] items-center justify-center bg-zinc-950 px-4">
      <div className="w-full max-w-md space-y-6 rounded-xl border border-white/[0.08] bg-zinc-900/60 p-6">
        <div>
          <p className="text-xs uppercase tracking-wide text-zinc-500">Aura</p>
          <h1 className="mt-1 text-xl font-semibold text-zinc-50">
            Convite para workspace
          </h1>
          <p className="mt-2 text-sm text-zinc-400">
            Aceite o convite com a mesma conta de e-mail que recebeu o link.
          </p>
        </div>

        {!user ? (
          <div className="space-y-3 text-sm text-zinc-300">
            <p>Entre ou crie sua conta para continuar.</p>
            <div className="flex gap-2">
              <Link
                href={`/login?redirect=${encodeURIComponent(`/convite/${token}`)}`}
                className="rounded-md bg-white/10 px-3 py-2 hover:bg-white/15"
              >
                Entrar
              </Link>
              <Link
                href={`/cadastro`}
                className="rounded-md bg-violet-500 px-3 py-2 text-white"
              >
                Criar conta
              </Link>
            </div>
          </div>
        ) : (
          <AcceptInviteForm token={token} />
        )}
      </div>
    </main>
  );
}
