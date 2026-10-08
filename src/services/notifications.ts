import { supabase } from "./supabase";

export function formatTimeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const seconds = Math.floor(
    (now.getTime() - date.getTime()) / 1000
  );

  if (seconds < 60) return 'Just now';
  if (seconds < 3600) 
    return `${Math.floor(seconds / 60)} minutes ago`;
  if (seconds < 86400) 
    return `${Math.floor(seconds / 3600)} hours ago`;
  if (seconds < 172800) return 'Yesterday';
  return date.toLocaleDateString('en-ZA', { 
    day: 'numeric', month: 'short' 
  });
}

declare global {
  interface Window {
    OneSignal: any;
  }
}

export interface Notification {
  id: string;
  user_id: string | null;
  club_id: string | null;
  type: string;
  title: string;
  message: string;
  url: string | null;
  read: boolean;
  created_at: string;
}

// 1. OneSignal initialization
export async function initOneSignal(): Promise<void> {
  if (typeof window === "undefined") return;

  if (window.OneSignal) {
    return;
  }

  return new Promise<void>((resolve) => {
    const script = document.createElement("script");
    script.src = "https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js";
    script.async = true;
    script.onload = () => {
      if (window.OneSignal) {
        try {
          window.OneSignal.init({
            appId: import.meta.env.VITE_ONESIGNAL_APP_ID || "",
            notifyButton: { enable: false },
            allowLocalhostAsSecureOrigin: true
          }).then(() => {
            console.log("[OneSignal] Initialized successfully");
            resolve();
          }).catch((err: any) => {
            console.warn("[OneSignal] Init promise failed:", err);
            resolve(); // Resolve anyway so we don't block app initialization
          });
        } catch (err) {
          console.warn("[OneSignal] Exception during init:", err);
          resolve();
        }
      } else {
        resolve();
      }
    };
    script.onerror = (err) => {
      console.warn("[OneSignal] Script failed to load:", err);
      resolve(); // Non-blocking
    };
    document.head.appendChild(script);
  });
}

// 2. Subscribe User to Push
export async function subscribeUserToPush(userId: string, clubId?: string, userRole?: string): Promise<string> {
  if (typeof window === "undefined") {
    return "default";
  }

  // Attempt standard web Notification API first or as fallback
  if (window.OneSignal) {
    try {
      if (userId) {
        await window.OneSignal.login(userId);
      }
      if (clubId) {
        await window.OneSignal.User?.addTag("club_id", clubId);
      }
      if (userRole) {
        await window.OneSignal.User?.addTag("role", userRole);
      }

      const result = await window.OneSignal.Notifications?.requestPermission();
      console.log("[OneSignal] Permission result:", result);
      if (result) return result;
    } catch (err) {
      console.warn("[OneSignal] Error in subscribeUserToPush:", err);
    }
  }

  // Native Web Notification API fallback if OneSignal script is missing or fails
  if ("Notification" in window) {
    try {
      const perm = await Notification.requestPermission();
      return perm;
    } catch (err) {
      console.warn("[Notifications] Standard Notification.requestPermission failed:", err);
      return Notification.permission;
    }
  }

  return "default";
}

// 3. Unsubscribe From Push
export async function unsubscribeFromPush(): Promise<void> {
  if (typeof window === "undefined" || !window.OneSignal) return;
  try {
    await window.OneSignal.User?.PushSubscription?.optOut();
    console.log("[OneSignal] Opted out of push");
  } catch (err) {
    console.warn("[OneSignal] Error in unsubscribeFromPush:", err);
  }
}

// 4. Check if push enabled
export function isPushEnabled(): boolean {
  if (typeof window === "undefined") return false;
  if (window.OneSignal?.User?.PushSubscription?.optedIn) {
    return true;
  }
  if (typeof Notification !== "undefined" && Notification.permission === "granted") {
    return true;
  }
  return false;
}

// 5. Supabase notification functions

// Local Storage Fallback Key for Mock Notifications
const MOCK_NOTIFICATIONS_KEY = "mock_notifications";

function getMockNotifications(userId: string): Notification[] {
  try {
    const raw = localStorage.getItem(MOCK_NOTIFICATIONS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return parsed.filter((n: any) => n.user_id === userId || n.user_id === null);
  } catch (err) {
    console.warn("Error reading mock notifications:", err);
    return [];
  }
}

function saveMockNotifications(notifications: Notification[]) {
  try {
    localStorage.setItem(MOCK_NOTIFICATIONS_KEY, JSON.stringify(notifications));
  } catch (err) {
    console.warn("Error saving mock notifications:", err);
  }
}

// Seed default notifications in simulation if empty
try {
  if (typeof window !== "undefined") {
    const raw = localStorage.getItem(MOCK_NOTIFICATIONS_KEY);
    if (!raw) {
      const defaultMocks = [
        {
          id: "mock-n-1",
          user_id: null,
          club_id: null,
          type: "new_club",
          title: "Welcome to PROOF Network 🏛️",
          message: "You've gained access to our global private-membership whisky club federation. Apply to join clubs near you.",
          url: "/clubs",
          read: false,
          created_at: new Date(Date.now() - 30 * 60000).toISOString() // 30 mins ago
        },
        {
          id: "mock-n-2",
          user_id: null,
          club_id: null,
          type: "club_announcement",
          title: "Masterclass Announcement",
          message: "Join us this Friday for an exclusive Speyside Tasting Masterclass. Details are in the events tab.",
          url: "/events",
          read: true,
          created_at: new Date(Date.now() - 4 * 3600000).toISOString() // 4 hours ago
        }
      ];
      localStorage.setItem(MOCK_NOTIFICATIONS_KEY, JSON.stringify(defaultMocks));
    }
  }
} catch (e) {}

export async function getNotifications(userId: string): Promise<{ data: Notification[] | null; error: any }> {
  if (!supabase) {
    console.log("[getNotifications] Running in Simulation Mode (Mock Notifications)");
    return { data: getMockNotifications(userId), error: null };
  }

  try {
    // Postgres view already excludes anything this user
    // has dismissed via its internal auth.uid() check —
    // no manual dismissal lookup or filtering needed
    const { data, error } = await supabase
      .from('user_visible_notifications')
      .select('*')
      .or(`user_id.eq.${userId},user_id.is.null`)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      console.warn("[getNotifications] Supabase read from view returned error, using fallback:", error);
      return { data: getMockNotifications(userId), error: null };
    }

    return { data: data as Notification[], error: null };

  } catch (err: any) {
    console.warn("[getNotifications] Exception occurred, using fallback:", err);
    return { data: getMockNotifications(userId), error: null };
  }
}

export async function markNotificationRead(notificationId: string): Promise<{ success: boolean; error: any }> {
  if (!supabase) {
    try {
      const raw = localStorage.getItem(MOCK_NOTIFICATIONS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        const idx = parsed.findIndex((n: any) => n.id === notificationId);
        if (idx !== -1) {
          parsed[idx].read = true;
          saveMockNotifications(parsed);
        }
      }
    } catch (e) {}
    return { success: true, error: null };
  }

  try {
    const { error } = await supabase
      .from("notifications")
      .update({ read: true })
      .eq("id", notificationId);

    return { success: !error, error };
  } catch (err: any) {
    console.warn("[markNotificationRead] Exception:", err);
    return { success: false, error: err };
  }
}

export async function dismissNotification(
  userId: string,
  notificationId: string
): Promise<{ error: any }> {
  if (!supabase) {
    try {
      const raw = localStorage.getItem(MOCK_NOTIFICATIONS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        const filtered = parsed.filter((n: any) => n.id !== notificationId);
        saveMockNotifications(filtered);
      }
    } catch (e) {}
    return { error: null };
  }

  console.log('[dismissNotification] Dismissing:', { userId, notificationId });

  try {
    const { error } = await supabase
      .from('notification_dismissals')
      .insert([{ 
        user_id: userId, 
        notification_id: notificationId 
      }]);

    if (error) {
      console.error('[dismissNotification] Failed:', error);
    }
    return { error };
  } catch (err: any) {
    console.error('[dismissNotification] Exception:', err);
    return { error: err };
  }
}

export async function dismissAllNotifications(
  userId: string,
  notificationIds: string[]
): Promise<{ error: any }> {
  if (!supabase || notificationIds.length === 0) {
    if (!supabase && notificationIds.length > 0) {
      try {
        const raw = localStorage.getItem(MOCK_NOTIFICATIONS_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          const filtered = parsed.filter((n: any) => !notificationIds.includes(n.id));
          saveMockNotifications(filtered);
        }
      } catch (e) {}
    }
    return { error: null };
  }

  console.log('[dismissAllNotifications] Dismissing:', notificationIds.length, 'notifications');

  try {
    const { error } = await supabase
      .from('notification_dismissals')
      .insert(
        notificationIds.map(id => ({
          user_id: userId,
          notification_id: id
        }))
      );

    if (error) {
      console.error('[dismissAllNotifications] Failed:', error);
    }
    return { error };
  } catch (err: any) {
    console.error('[dismissAllNotifications] Exception:', err);
    return { error: err };
  }
}

export async function markAllNotificationsRead(userId: string): Promise<{ success: boolean; error: any }> {
  if (!supabase) {
    try {
      const raw = localStorage.getItem(MOCK_NOTIFICATIONS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        parsed.forEach((n: any) => {
          if (n.user_id === userId || n.user_id === null) {
            n.read = true;
          }
        });
        saveMockNotifications(parsed);
      }
    } catch (e) {}
    return { success: true, error: null };
  }

  try {
    const { error } = await supabase
      .from("notifications")
      .update({ read: true })
      .eq("user_id", userId)
      .eq("read", false);

    return { success: !error, error };
  } catch (err: any) {
    console.warn("[markAllNotificationsRead] Exception:", err);
    return { success: false, error: err };
  }
}

export function subscribeToNotifications(
  userId: string,
  onNewNotification: (n: Notification) => void
): () => void {
  if (!supabase) {
    console.log("[subscribeToNotifications] Simulation Mode: Realtime not active");
    return () => {};
  }

  console.log("[subscribeToNotifications] Subscribing to postgres_changes on public.notifications for user:", userId);

  const channel = supabase
    .channel(`notifications-realtime-all-${userId}`)
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "notifications"
      },
      (payload) => {
        const newNotif = payload.new as Notification;
        console.log("[subscribeToNotifications] Postgres INSERT change detected:", newNotif);

        // Security / Relevance Filter:
        // Accept notification if user_id matches targeted user ID, or user_id is null/undefined (which indicates global or club-targeted broadcast).
        // Since Supabase RLS is enabled, the backend realtime service automatically ensures
        // the socket connection only receives records the user is authorized to SELECT based on RLS rules.
        const isTargetedToMe = newNotif.user_id === userId;
        const isBroadcast = !newNotif.user_id; // fits both null and undefined values

        if (isTargetedToMe || isBroadcast) {
          console.log("[subscribeToNotifications] Notification matches client relevance check, triggering state dispatch:", newNotif);
          onNewNotification(newNotif);
        } else {
          console.log("[subscribeToNotifications] Ignored socket row (insert targets a different user or is outside membership scope):", newNotif.id);
        }
      }
    )
    .subscribe((status) => {
      console.log(`[subscribeToNotifications] Connection channel state updated: ${status}`);
    });

  return () => {
    console.log("[subscribeToNotifications] Disconnecting realtime publication listener for: all-", userId);
    supabase.removeChannel(channel);
  };
}

export const NOTIFICATION_ICONS: Record<string, string> = {
  ticket_confirmed: "🎫",
  order_confirmed: "📦",
  order_shipped: "🚚",
  order_delivered: "✅",
  new_event: "🥃",
  new_product: "🛍️",
  new_club: "🏛️",
  club_announcement: "📢",
};
