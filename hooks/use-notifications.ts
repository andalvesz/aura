"use client";

import { useCallback, useEffect, useState } from "react";
import type { Notification } from "@/types/database";
import { parseJsonResponse } from "@/utils/safe-json";

export function useNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  const unreadCount = notifications.filter((n) => n.status === "unread").length;

  const refresh = useCallback(async () => {
    const response = await fetch("/api/notifications");
    const { data, error: parseError } = await parseJsonResponse<{
      notifications?: Notification[];
      error?: string;
    }>(response);

    if (parseError || !response.ok) {
      throw new Error(parseError ?? data?.error ?? "Erro ao carregar notificações.");
    }

    setNotifications(data?.notifications ?? []);
    return data?.notifications ?? [];
  }, []);

  const sync = useCallback(async () => {
    setSyncing(true);
    try {
      const response = await fetch("/api/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "sync" }),
      });

      const { data, error: parseError } = await parseJsonResponse<{
        notifications?: Notification[];
        error?: string;
      }>(response);

      if (parseError || !response.ok) {
        throw new Error(parseError ?? data?.error ?? "Erro ao sincronizar notificações.");
      }

      setNotifications(data?.notifications ?? []);
    } finally {
      setSyncing(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        const response = await fetch("/api/notifications", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "sync" }),
        });

        const { data, error: parseError } = await parseJsonResponse<{
          notifications?: Notification[];
          error?: string;
        }>(response);

        if (cancelled) return;

        if (parseError || !response.ok) {
          setNotifications([]);
          return;
        }

        setNotifications(data?.notifications ?? []);
      } catch {
        if (!cancelled) setNotifications([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const markAsRead = useCallback(async (id: string) => {
    const response = await fetch(`/api/notifications/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "read" }),
    });

    const { data, error: parseError } = await parseJsonResponse<{
      notification?: Notification;
      error?: string;
    }>(response);

    if (parseError || !response.ok) {
      throw new Error(parseError ?? data?.error ?? "Erro ao marcar como lida.");
    }

    setNotifications((current) =>
      current.map((n) =>
        n.id === id
          ? { ...n, status: "read", read_at: data?.notification?.read_at ?? new Date().toISOString() }
          : n
      )
    );
  }, []);

  const remove = useCallback(async (id: string) => {
    const response = await fetch(`/api/notifications/${id}`, {
      method: "DELETE",
    });

    const { data, error: parseError } = await parseJsonResponse<{ error?: string }>(response);

    if (parseError || !response.ok) {
      throw new Error(parseError ?? data?.error ?? "Erro ao excluir notificação.");
    }

    setNotifications((current) => current.filter((n) => n.id !== id));
  }, []);

  const markAllAsRead = useCallback(async () => {
    const response = await fetch("/api/notifications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "read-all" }),
    });

    const { data, error: parseError } = await parseJsonResponse<{ error?: string }>(response);

    if (parseError || !response.ok) {
      throw new Error(parseError ?? data?.error ?? "Erro ao marcar todas como lidas.");
    }

    setNotifications((current) =>
      current.map((n) =>
        n.status === "unread"
          ? { ...n, status: "read", read_at: new Date().toISOString() }
          : n
      )
    );
  }, []);

  return {
    notifications,
    unreadCount,
    loading,
    syncing,
    refresh,
    sync,
    markAsRead,
    markAllAsRead,
    remove,
  };
}
