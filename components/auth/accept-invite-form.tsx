"use client";

import { useActionState } from "react";
import Link from "next/link";
import {
  acceptInviteAction,
  type WorkspaceActionState,
} from "@/app/actions/workspace";

export function AcceptInviteForm({ token }: { token: string }) {
  const [state, formAction, pending] = useActionState(
    acceptInviteAction,
    {} as WorkspaceActionState
  );

  if (state.success) {
    return (
      <div className="space-y-4 text-center">
        <p className="text-emerald-400">{state.success}</p>
        <Link
          href="/dashboard/alvesz"
          className="inline-flex rounded-md bg-violet-500 px-4 py-2 text-sm font-medium text-white"
        >
          Abrir Alvesz
        </Link>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="token" value={token} />
      {state.error ? <p className="text-sm text-rose-400">{state.error}</p> : null}
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-md bg-violet-500 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50"
      >
        {pending ? "Aceitando…" : "Aceitar convite"}
      </button>
    </form>
  );
}
