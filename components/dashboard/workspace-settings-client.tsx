"use client";

import { useActionState, useState } from "react";
import {
  cancelInviteAction,
  createInviteAction,
  removeMemberAction,
  updateMemberRoleAction,
  type WorkspaceActionState,
} from "@/app/actions/workspace";
import { canManageMembers } from "@/lib/workspace/constants";
import type { WorkspaceRole } from "@/types/database";

type MemberRow = {
  id: string;
  user_id: string;
  role: WorkspaceRole;
  status: string;
  profile: {
    id: string;
    full_name: string | null;
    email: string;
    avatar_url: string | null;
  } | null;
};

type InviteRow = {
  id: string;
  email: string;
  role: string;
  expires_at: string;
  created_at: string;
};

type WorkspaceSettingsClientProps = {
  workspaceId: string;
  workspaceName: string;
  actorRole: WorkspaceRole;
  members: MemberRow[];
  invites: InviteRow[];
};

export function WorkspaceSettingsClient({
  workspaceId,
  workspaceName,
  actorRole,
  members,
  invites,
}: WorkspaceSettingsClientProps) {
  const canManage = canManageMembers(actorRole);
  const [state, formAction, pending] = useActionState(
    createInviteAction,
    {} as WorkspaceActionState
  );
  const [copied, setCopied] = useState(false);

  async function copyInvite() {
    if (!state.inviteUrl) return;
    await navigator.clipboard.writeText(state.inviteUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <header>
        <p className="text-xs uppercase tracking-wide text-zinc-500">Configurações</p>
        <h1 className="mt-1 text-xl font-semibold text-zinc-100">Workspace</h1>
        <p className="mt-1 text-sm text-zinc-400">{workspaceName}</p>
      </header>

      <section className="space-y-3">
        <h2 className="text-sm font-medium text-zinc-200">Membros</h2>
        <ul className="divide-y divide-white/[0.06] rounded-lg border border-white/[0.08]">
          {members.map((m) => (
            <li
              key={m.id}
              className="flex flex-wrap items-center justify-between gap-3 px-3 py-3"
            >
              <div>
                <p className="text-sm text-zinc-100">
                  {m.profile?.full_name || m.profile?.email || m.user_id}
                  {m.role === "owner" ? (
                    <span className="ml-2 text-[10px] uppercase tracking-wide text-amber-400">
                      Owner
                    </span>
                  ) : null}
                </p>
                <p className="text-xs text-zinc-500">
                  {m.profile?.email} · {m.role} · {m.status}
                </p>
              </div>
              {canManage && m.role !== "owner" ? (
                <div className="flex items-center gap-2">
                  {actorRole === "owner" ? (
                    <form action={updateMemberRoleAction}>
                      <input type="hidden" name="memberId" value={m.id} />
                      <input type="hidden" name="workspaceId" value={workspaceId} />
                      <select
                        name="role"
                        defaultValue={m.role}
                        className="rounded-md border border-white/[0.08] bg-zinc-950 px-2 py-1 text-xs text-zinc-200"
                        onChange={(e) => e.currentTarget.form?.requestSubmit()}
                      >
                        <option value="admin">admin</option>
                        <option value="member">member</option>
                      </select>
                    </form>
                  ) : null}
                  <form action={removeMemberAction}>
                    <input type="hidden" name="memberId" value={m.id} />
                    <input type="hidden" name="workspaceId" value={workspaceId} />
                    <button
                      type="submit"
                      className="rounded-md px-2 py-1 text-xs text-rose-400 hover:bg-rose-500/10"
                    >
                      Remover
                    </button>
                  </form>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      </section>

      {canManage ? (
        <section className="space-y-3">
          <h2 className="text-sm font-medium text-zinc-200">Convidar membro</h2>
          <form action={formAction} className="flex flex-wrap items-end gap-2">
            <input type="hidden" name="workspaceId" value={workspaceId} />
            <label className="flex flex-col gap-1 text-xs text-zinc-500">
              E-mail
              <input
                name="email"
                type="email"
                required
                className="min-w-[14rem] rounded-md border border-white/[0.08] bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
                placeholder="socio@email.com"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs text-zinc-500">
              Papel
              <select
                name="role"
                defaultValue="member"
                className="rounded-md border border-white/[0.08] bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
              >
                <option value="member">member</option>
                {actorRole === "owner" ? <option value="admin">admin</option> : null}
              </select>
            </label>
            <button
              type="submit"
              disabled={pending}
              className="rounded-md bg-violet-500/90 px-3 py-2 text-sm font-medium text-white hover:bg-violet-500 disabled:opacity-50"
            >
              {pending ? "Gerando…" : "Gerar convite"}
            </button>
          </form>
          {state.error ? (
            <p className="text-sm text-rose-400">{state.error}</p>
          ) : null}
          {state.success ? (
            <p className="text-sm text-emerald-400">{state.success}</p>
          ) : null}
          {state.inviteUrl ? (
            <div className="flex flex-wrap items-center gap-2 rounded-md border border-white/[0.08] bg-zinc-950/60 p-3">
              <code className="max-w-full flex-1 truncate text-xs text-zinc-300">
                {state.inviteUrl}
              </code>
              <button
                type="button"
                onClick={copyInvite}
                className="rounded-md border border-white/[0.1] px-3 py-1.5 text-xs text-zinc-200 hover:bg-white/[0.06]"
              >
                {copied ? "Copiado" : "Copiar convite"}
              </button>
            </div>
          ) : null}

          {invites.length > 0 ? (
            <ul className="space-y-2">
              {invites.map((inv) => (
                <li
                  key={inv.id}
                  className="flex items-center justify-between gap-2 rounded-md border border-white/[0.06] px-3 py-2 text-sm"
                >
                  <span className="text-zinc-300">
                    {inv.email} · {inv.role} · expira{" "}
                    {new Date(inv.expires_at).toLocaleDateString("pt-BR")}
                  </span>
                  <form action={cancelInviteAction}>
                    <input type="hidden" name="inviteId" value={inv.id} />
                    <input type="hidden" name="workspaceId" value={workspaceId} />
                    <button type="submit" className="text-xs text-zinc-500 hover:text-rose-400">
                      Cancelar
                    </button>
                  </form>
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      ) : (
        <p className="text-sm text-zinc-500">
          Apenas owner/admin gerenciam membros e convites.
        </p>
      )}
    </div>
  );
}
