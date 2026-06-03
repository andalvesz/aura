"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  Bell,
  Check,
  CheckCheck,
  Loader2,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { useNotifications } from "@/hooks/use-notifications";
import type { Notification } from "@/types/database";
import {
  getNotificationHref,
  NOTIFICATION_TYPE_LABELS,
} from "@/utils/notifications";
import { cn } from "@/utils/cn";
import { formatDate, formatSafeTime, isValidDate } from "@/utils/format";

function formatWhen(iso: string | null) {
  if (!iso || !isValidDate(iso)) return "";
  const date = new Date(iso);
  const now = new Date();
  const isTodayDate =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();

  if (isTodayDate) {
    return formatSafeTime(iso, "");
  }

  return formatDate(iso, "");
}

function NotificationItem({
  notification,
  compact,
  onRead,
  onDelete,
}: {
  notification: Notification;
  compact?: boolean;
  onRead: (id: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const href = getNotificationHref(notification);
  const isUnread = notification.status === "unread";

  async function handleRead() {
    if (!isUnread) return;
    setBusy(true);
    try {
      await onRead(notification.id);
    } catch {
      toast.error("Não foi possível marcar como lida.");
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    setBusy(true);
    try {
      await onDelete(notification.id);
      toast.success("Notificação removida.");
    } catch {
      toast.error("Não foi possível excluir.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className={cn(
        "group rounded-lg border px-3 py-2.5 transition-colors",
        isUnread
          ? "border-violet-500/20 bg-violet-500/[0.06]"
          : "border-white/[0.06] bg-white/[0.02]"
      )}
    >
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <p className="text-[12px] font-medium text-zinc-100">{notification.title}</p>
            <span className="rounded bg-white/[0.06] px-1.5 py-0.5 text-[10px] text-zinc-500">
              {NOTIFICATION_TYPE_LABELS[notification.type]}
            </span>
          </div>
          <p className="mt-1 text-[12px] leading-relaxed text-zinc-400">
            {notification.message}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-[10px] text-zinc-600">
            <span>{formatWhen(notification.scheduled_for ?? notification.created_at)}</span>
            {!compact && notification.related_module && (
              <Link href={href} className="text-violet-400 hover:underline">
                Abrir módulo
              </Link>
            )}
          </div>
        </div>
        <div className="flex shrink-0 gap-0.5">
          {isUnread && (
            <button
              type="button"
              disabled={busy}
              onClick={handleRead}
              aria-label="Marcar como lida"
              className="flex size-9 items-center justify-center rounded-md text-zinc-500 transition-colors hover:bg-white/[0.06] hover:text-emerald-400 disabled:opacity-50"
            >
              <Check className="size-3.5" />
            </button>
          )}
          <button
            type="button"
            disabled={busy}
            onClick={handleDelete}
            aria-label="Excluir notificação"
            className="flex size-9 items-center justify-center rounded-md text-zinc-500 transition-colors hover:bg-white/[0.06] hover:text-rose-400 disabled:opacity-50"
          >
            <Trash2 className="size-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

export function NotificationsBell() {
  const {
    notifications,
    unreadCount,
    loading,
    syncing,
    markAsRead,
    markAllAsRead,
    remove,
    sync,
  } = useNotifications();
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: MouseEvent) {
      if (!panelRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const preview = notifications.slice(0, 8);

  return (
    <div ref={panelRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-label="Notificações"
        aria-expanded={open}
        className="relative flex size-11 items-center justify-center rounded-md text-zinc-500 transition-colors duration-200 hover:bg-white/[0.04] hover:text-zinc-300 md:size-8"
      >
        <Bell className="size-3.5" />
        {unreadCount > 0 && (
          <span className="absolute right-1 top-1 flex min-w-[16px] items-center justify-center rounded-full bg-violet-500 px-1 text-[9px] font-semibold text-white md:right-0.5 md:top-0.5">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-[calc(100%+0.5rem)] z-50 w-[min(22rem,calc(100vw-1.5rem))] overflow-hidden rounded-xl border border-white/[0.08] bg-zinc-950/95 shadow-2xl backdrop-blur-xl">
          <div className="flex items-center justify-between border-b border-white/[0.06] px-3 py-2.5">
            <div>
              <p className="text-[13px] font-medium text-zinc-100">Notificações</p>
              <p className="text-[10px] text-zinc-600">
                {unreadCount > 0 ? `${unreadCount} não lida(s)` : "Tudo em dia"}
              </p>
            </div>
            <div className="flex items-center gap-1">
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={() => markAllAsRead().catch(() => toast.error("Erro ao marcar todas."))}
                  className="flex size-9 items-center justify-center rounded-md text-zinc-500 hover:bg-white/[0.06] hover:text-zinc-300"
                  aria-label="Marcar todas como lidas"
                >
                  <CheckCheck className="size-3.5" />
                </button>
              )}
              <button
                type="button"
                onClick={() => sync().catch(() => toast.error("Erro ao atualizar."))}
                disabled={syncing}
                className="flex size-9 items-center justify-center rounded-md text-zinc-500 hover:bg-white/[0.06] hover:text-zinc-300 disabled:opacity-50"
                aria-label="Atualizar notificações"
              >
                {syncing ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Bell className="size-3.5" />
                )}
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="flex size-9 items-center justify-center rounded-md text-zinc-500 hover:bg-white/[0.06] hover:text-zinc-300 md:hidden"
                aria-label="Fechar"
              >
                <X className="size-3.5" />
              </button>
            </div>
          </div>

          <div className="max-h-[min(60vh,420px)] space-y-2 overflow-y-auto p-2">
            {loading ? (
              <div className="flex items-center justify-center gap-2 py-8 text-[12px] text-zinc-500">
                <Loader2 className="size-4 animate-spin" />
                Carregando...
              </div>
            ) : preview.length === 0 ? (
              <p className="py-8 text-center text-[12px] text-zinc-500">
                Nenhuma notificação no momento.
              </p>
            ) : (
              preview.map((notification) => (
                <NotificationItem
                  key={notification.id}
                  notification={notification}
                  compact
                  onRead={markAsRead}
                  onDelete={remove}
                />
              ))
            )}
          </div>

          <div className="border-t border-white/[0.06] p-2">
            <Link
              href="/dashboard/notificacoes"
              onClick={() => setOpen(false)}
              className="flex min-h-11 items-center justify-center rounded-md text-[12px] font-medium text-violet-400 transition-colors hover:bg-violet-500/10"
            >
              Ver todas
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

export function NotificationsList() {
  const {
    notifications,
    unreadCount,
    loading,
    syncing,
    markAsRead,
    markAllAsRead,
    remove,
    sync,
  } = useNotifications();

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-zinc-100 sm:text-2xl">Notificações</h1>
          <p className="mt-0.5 text-sm text-zinc-500">
            Lembretes e alertas internos da Aura OS
            {unreadCount > 0 ? ` · ${unreadCount} não lida(s)` : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {unreadCount > 0 && (
            <button
              type="button"
              onClick={() => markAllAsRead().catch(() => toast.error("Erro ao marcar todas."))}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-md border border-white/[0.08] bg-white/[0.03] px-3 text-[12px] text-zinc-300 hover:bg-white/[0.06]"
            >
              <CheckCheck className="size-3.5" />
              Marcar todas como lidas
            </button>
          )}
          <button
            type="button"
            disabled={syncing}
            onClick={() => sync().catch(() => toast.error("Erro ao atualizar."))}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-md border border-violet-500/20 bg-violet-500/10 px-3 text-[12px] text-violet-300 hover:bg-violet-500/15 disabled:opacity-50"
          >
            {syncing ? <Loader2 className="size-3.5 animate-spin" /> : <Bell className="size-3.5" />}
            Atualizar alertas
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-sm text-zinc-500">
          <Loader2 className="size-4 animate-spin" />
          Carregando notificações...
        </div>
      ) : notifications.length === 0 ? (
        <div className="rounded-xl border border-white/[0.08] bg-zinc-950/40 px-4 py-12 text-center">
          <Bell className="mx-auto size-8 text-zinc-600" />
          <p className="mt-3 text-sm text-zinc-400">Nenhuma notificação por enquanto.</p>
          <p className="mt-1 text-[12px] text-zinc-600">
            A Aura gera alertas para leads, eventos, missões, conteúdos, treinos e orçamentos.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {notifications.map((notification) => (
            <NotificationItem
              key={notification.id}
              notification={notification}
              onRead={markAsRead}
              onDelete={remove}
            />
          ))}
        </div>
      )}
    </div>
  );
}
