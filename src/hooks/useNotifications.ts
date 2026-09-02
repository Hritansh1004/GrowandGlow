import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabaseClient";

export interface AppNotification {
  id: string;
  user_id: string;
  type: "friend_request_received" | "friend_request_accepted" | "room_invite_received" | string;
  payload: any;
  is_read: boolean;
  action_result?: "accepted" | "declined" | "joined" | null;
  created_at: string;
  fromProfile?: any;
}

export default function useNotifications(userId: string | undefined | null) {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  const notificationsRef = useRef<AppNotification[]>([]);
  notificationsRef.current = notifications;

  const attachProfiles = useCallback(async (rows: any[]) => {
    const fromIds = rows.map((r) => r.payload?.from_user_id).filter(Boolean);
    if (fromIds.length === 0) {
      return rows.map((r) => ({ ...r, fromProfile: null }));
    }

    const { data: profiles, error } = await supabase
      .from("profiles")
      .select("id, username, display_name, avatar_url")
      .in("id", [...new Set(fromIds)]);

    if (error) {
      console.error("notifications: profile lookup error:", error);
    }

    const profileMap: Record<string, any> = {};
    (profiles || []).forEach((p: any) => {
      profileMap[p.id] = p;
    });

    return rows.map((r) => ({
      ...r,
      fromProfile: r.payload?.from_user_id ? profileMap[r.payload.from_user_id] || null : null,
    }));
  }, []);

  const loadNotifications = useCallback(async () => {
    if (!userId) {
      setNotifications([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setMessage("");

    try {
      const { data: rows, error } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) {
        console.error("notifications load error:", error);
        setMessage(`Could not load notifications: ${error.message}`);
        setNotifications([]);
        return;
      }

      const withProfiles = await attachProfiles(rows || []);
      setNotifications(withProfiles);
    } catch (err: any) {
      console.error("notifications load exception:", err);
      setMessage(`Could not load notifications: ${err?.message || "Network error."}`);
      setNotifications([]);
    } finally {
      setLoading(false);
    }
  }, [userId, attachProfiles]);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  useEffect(() => {
    if (!userId) return;

    const freshSuffix = `${Date.now()}_${Math.random().toString(36).slice(2)}`;

    const channel = supabase
      .channel(`notifications:${userId}:${freshSuffix}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` },
        async (payload) => {
          const newRow = payload.new as any;
          if (notificationsRef.current.some((n) => n.id === newRow.id)) return;
          const [withProfile] = await attachProfiles([newRow]);
          setNotifications((prev) => [withProfile, ...prev]);
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` },
        (payload) => {
          const updated = payload.new as any;
          setNotifications((prev) =>
            prev.map((n) => (n.id === updated.id ? { ...n, ...updated } : n))
          );
        }
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` },
        (payload) => {
          const removedId = (payload.old as any)?.id;
          setNotifications((prev) => prev.filter((n) => n.id !== removedId));
        }
      )
      .subscribe();

    const pollInterval = setInterval(loadNotifications, 30000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(pollInterval);
    };
  }, [userId, attachProfiles, loadNotifications]);

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  async function markRead(notificationId: string) {
    const { error } = await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("id", notificationId);

    if (error) {
      console.error("notifications markRead error:", error);
      setMessage(`Could not mark as read: ${error.message}`);
      return { success: false, error: error.message };
    }

    setNotifications((prev) =>
      prev.map((n) => (n.id === notificationId ? { ...n, is_read: true } : n))
    );
    return { success: true };
  }

  async function markAllRead() {
    if (!userId) return { success: false };

    const { error } = await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("user_id", userId);

    if (error) {
      console.error("notifications markAllRead error:", error);
      setMessage(`Could not mark all as read: ${error.message}`);
      return { success: false, error: error.message };
    }

    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    return { success: true };
  }

  // Persists which action the user took on an actionable notification
  // (friend request / room invite), so the UI can permanently show
  // "Accepted" / "Declined" / "Joined" instead of re-showing live
  // action buttons after a reload.
  async function markActioned(notificationId: string, result: "accepted" | "declined" | "joined") {
    const { error } = await supabase
      .from("notifications")
      .update({ action_result: result, is_read: true })
      .eq("id", notificationId);

    if (error) {
      console.error("notifications markActioned error:", error);
      setMessage(`Could not save your response: ${error.message}`);
      return { success: false, error: error.message };
    }

    setNotifications((prev) =>
      prev.map((n) => (n.id === notificationId ? { ...n, action_result: result, is_read: true } : n))
    );
    return { success: true };
  }

  async function deleteNotification(notificationId: string) {
    const { error } = await supabase.from("notifications").delete().eq("id", notificationId);

    if (error) {
      console.error("notifications delete error:", error);
      setMessage(`Could not delete notification: ${error.message}`);
      return { success: false, error: error.message };
    }

    setNotifications((prev) => prev.filter((n) => n.id !== notificationId));
    return { success: true };
  }

  return {
    notifications,
    unreadCount,
    loading,
    message,
    markRead,
    markAllRead,
    markActioned,
    deleteNotification,
    reload: loadNotifications,
  };
}