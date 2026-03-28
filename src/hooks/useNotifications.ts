import { useEffect, useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../supabaseClient";
import { useAuth } from "../contexts/AuthContext";
import { showToast } from "../utils/toast";

export interface Notification {
  id: string;
  type:
  | "work_order"
  | "sale"
  | "inventory"
  | "inventory_warning"
  | "debt"
  | "cash";
  title: string;
  message: string;
  data: Record<string, any>;
  created_by: string | null;
  recipient_id: string | null;
  recipient_role: string | null;
  branch_id: string | null;
  is_read: boolean;
  read_at: string | null;
  created_at: string;
}

export function useNotifications() {
  const { user, profile } = useAuth();
  const queryClient = useQueryClient();
  const [realtimeEnabled, setRealtimeEnabled] = useState(false);

  // Fetch notifications
  const {
    data: notifications = [],
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ["notifications", user?.id],
    queryFn: async () => {
      if (!user) return [];

      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) {
        console.error("Error fetching notifications:", error);
        return [];
      }

      return data as Notification[];
    },
    enabled: !!user,
    staleTime: 30 * 1000, // 30 seconds
  });

  // Calculate unread count
  const unreadCount = notifications.filter((n) => !n.is_read).length;

  // Mark single notification as read
  const markAsReadMutation = useMutation({
    mutationFn: async (notificationId: string) => {
      const { error } = await supabase
        .from("notifications")
        .update({ is_read: true, read_at: new Date().toISOString() })
        .eq("id", notificationId);

      if (error) throw error;
      return notificationId;
    },
    onSuccess: (notificationId) => {
      queryClient.setQueryData<Notification[]>(
        ["notifications", user?.id],
        (old) =>
          old?.map((n) =>
            n.id === notificationId
              ? { ...n, is_read: true, read_at: new Date().toISOString() }
              : n
          ) ?? []
      );
    },
  });

  // Mark all as read
  const markAllAsReadMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("notifications")
        .update({ is_read: true, read_at: new Date().toISOString() })
        .eq("is_read", false);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.setQueryData<Notification[]>(
        ["notifications", user?.id],
        (old) =>
          old?.map((n) => ({
            ...n,
            is_read: true,
            read_at: n.read_at || new Date().toISOString(),
          })) ?? []
      );
    },
  });

  // Delete notification
  const deleteNotificationMutation = useMutation({
    mutationFn: async (notificationId: string) => {
      const { error } = await supabase
        .from("notifications")
        .delete()
        .eq("id", notificationId);

      if (error) throw error;
      return notificationId;
    },
    onSuccess: (notificationId) => {
      queryClient.setQueryData<Notification[]>(
        ["notifications", user?.id],
        (old) => old?.filter((n) => n.id !== notificationId) ?? []
      );
    },
  });

  // Clear all notifications
  const clearAllMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("notifications")
        .delete()
        .neq("id", "00000000-0000-0000-0000-000000000000"); // Delete all

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.setQueryData<Notification[]>(["notifications", user?.id], []);
    },
  });

  // Setup realtime subscription
  useEffect(() => {
    if (!user || realtimeEnabled) return;

    const channel = supabase
      .channel("notifications-realtime")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
        },
        (payload) => {
          const newNotification = payload.new as Notification;

          // Check if this notification is for current user
          const isForMe =
            newNotification.recipient_id === user.id ||
            newNotification.recipient_id === null ||
            newNotification.recipient_role === profile?.role ||
            newNotification.recipient_role === null;

          if (isForMe) {
            // Add to cache
            queryClient.setQueryData<Notification[]>(
              ["notifications", user.id],
              (old) => [newNotification, ...(old ?? [])]
            );

            // Show toast notification
            showToast.info(
              `${newNotification.title}: ${newNotification.message}`
            );

            // Show system notification
            showSystemNotification(newNotification.title, newNotification.message);
          }
        }
      )
      .subscribe((status: string) => {
        if (status === "SUBSCRIBED") {
          setRealtimeEnabled(true);
        }
      });

    // Request permission for system notifications
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }

    return () => {
      supabase.removeChannel(channel);
      setRealtimeEnabled(false);
    };
  }, [user, profile?.role, queryClient, realtimeEnabled]);

  // Helper to show system notification
  const showSystemNotification = (title: string, body: string) => {
    if (!("Notification" in window)) return;

    if (Notification.permission === "granted") {
      try {
        new Notification(title, {
          body,
          icon: "/logo-smartcare.png",
          // @ts-ignore
          vibrate: [200, 100, 200]
        });
      } catch (e) {
        console.error("Error showing system notification:", e);
      }
    }
  };


  // Helper functions
  const markAsRead = useCallback(
    (id: string) => markAsReadMutation.mutate(id),
    [markAsReadMutation]
  );

  const markAllAsRead = useCallback(
    () => markAllAsReadMutation.mutate(),
    [markAllAsReadMutation]
  );

  const deleteNotification = useCallback(
    (id: string) => deleteNotificationMutation.mutate(id),
    [deleteNotificationMutation]
  );

  const clearAll = useCallback(
    () => clearAllMutation.mutate(),
    [clearAllMutation]
  );

  return {
    notifications,
    unreadCount,
    isLoading,
    refetch,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    clearAll,
  };
}

// Helper to get icon based on notification type
function getNotificationIcon(type: string): string {
  switch (type) {
    case "work_order":
      return "🔧";
    case "sale":
      return "🛒";
    case "inventory":
      return "📦";
    case "inventory_warning":
      return "⚠️";
    case "debt":
      return "💰";
    case "cash":
      return "💵";
    default:
      return "🔔";
  }
}

// Export icon helper for use in components
export { getNotificationIcon };
