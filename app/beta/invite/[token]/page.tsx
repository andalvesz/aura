import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { acceptBetaInviteAction } from "@/app/actions/beta-ops";
import Link from "next/link";

type Props = { params: Promise<{ token: string }> };

export default async function BetaInviteAcceptPage({ params }: Props) {
  const { token } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/login?next=${encodeURIComponent(`/beta/invite/${token}`)}`);
  }

  const res = await acceptBetaInviteAction({
    token,
    email: user.email ?? "",
  });

  return (
    <div className="mx-auto max-w-md space-y-4 p-8" data-testid="beta-invite-accept">
      <h1 className="text-lg font-medium text-zinc-100">Convite beta</h1>
      {res.ok ? (
        <p className="text-[13px] text-zinc-300">
          Convite aceito. Cohort:{" "}
          {String((res.data as { cohort?: string } | undefined)?.cohort ?? "—")}
        </p>
      ) : (
        <p className="text-[13px] text-red-300" data-testid="beta-invite-error">
          {res.error}
          {res.correlationId ? ` · ${res.correlationId}` : ""}
        </p>
      )}
      <Link href="/dashboard" className="text-[12px] text-zinc-400 underline">
        Ir ao dashboard
      </Link>
    </div>
  );
}
