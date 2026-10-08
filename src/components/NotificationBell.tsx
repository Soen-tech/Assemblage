import React, { useState, useEffect, useRef } from "react";
import { Bell, BellRing, X, Trash2 } from "lucide-react";
import { View } from "../types";
import {
  initOneSignal,
  subscribeUserToPush,
  isPushEnabled,
  markNotificationRead,
  markAllNotificationsRead,
  dismissNotification,
  dismissAllNotifications,
  NOTIFICATION_ICONS,
  Notification,
  formatTimeAgo
} from "../services/notifications";

interface NotificationBellProps {
  userId: string;
  clubId?: string;
  userRole?: string;
  notifications: any[];
  unreadCount: number;
  onMarkAllRead: () => void;
  onMarkAsRead?: (id: string) => void;
  onDeleteNotification?: (id: string) => void;
  onClearAllNotifications?: () => void;
  onNavigate?: (view: View) => void;
}

export default function NotificationBell({
  userId,
  clubId,
  userRole,
  notifications,
  unreadCount,
  onMarkAllRead,
  onMarkAsRead,
  onDeleteNotification,
  onClearAllNotifications,
  onNavigate
}: NotificationBellProps) {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [pushEnabled, setPushEnabled] = useState<boolean>(false);
  const [permissionState, setPermissionState] = useState<string>("default");
  const [bannerDismissed, setBannerDismissed] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("push_banner_dismissed") === "true";
    }
    return false;
  });
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Initialize OneSignal status and permissions on mount
  useEffect(() => {
    let active = true;
    async function checkPush() {
      try {
        await initOneSignal();
        if (!active) return;
        setPushEnabled(isPushEnabled());
        if (typeof window !== "undefined" && "Notification" in window) {
          setPermissionState(window.Notification.permission);
        }
      } catch (err) {
        console.warn("[NotificationBell] OneSignal initialization check failed:", err);
      }
    }
    checkPush();
    return () => {
      active = false;
    };
  }, [userId]);

  // Click outside listener to dismiss notifications dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        isOpen &&
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  // Toggle dropdown / Mark all read
  const handleToggleOpen = async () => {
    const nextState = !isOpen;
    setIsOpen(nextState);

    if (nextState && unreadCount > 0) {
      onMarkAllRead();
      try {
        await markAllNotificationsRead(userId);
      } catch (err) {
        console.warn("Error marking all read:", err);
      }
    }
  };

  const handleMarkAllReadManual = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (unreadCount === 0) return;
    onMarkAllRead();
    try {
      await markAllNotificationsRead(userId);
    } catch (err) {
      console.warn("Manual read-all error:", err);
    }
  };

  // Clicking an individual notification
  const handleNotificationClick = async (notif: Notification) => {
    // 1. Mark as read immediately in parent state/UI for snappy interaction
    if (!notif.read) {
      if (onMarkAsRead) {
        onMarkAsRead(notif.id);
      }
      try {
        await markNotificationRead(notif.id);
      } catch (err) {
        console.warn("Error marking individual notification read in DB:", err);
      }
    }

    // 2. Perform smooth internal SPA navigation instead of refreshing the window href
    if (notif.url) {
      setIsOpen(false);
      let targetView: View | "" = "";
      if (notif.url === "/events") {
        targetView = "events";
      } else if (notif.url === "/boutique") {
        targetView = "boutique";
      } else if (notif.url === "/clubs" || notif.url === "/explore-clubs") {
        targetView = "explore-clubs";
      } else if (notif.url === "/journal") {
        targetView = "journal";
      } else if (notif.url === "/chat") {
        targetView = "chat";
      }

      if (targetView && onNavigate) {
        onNavigate(targetView);
      } else {
        window.location.href = notif.url;
      }
    }
  };

  // Dismiss push banner
  const handleDismissBanner = () => {
    setBannerDismissed(true);
    if (typeof window !== "undefined") {
      localStorage.setItem("push_banner_dismissed", "true");
    }
  };

  // Turning on Push notifications
  const handleEnablePush = async () => {
    try {
      const state = await subscribeUserToPush(userId, clubId, userRole);
      setPermissionState(state);
      const enabled = isPushEnabled() || state === "granted";
      setPushEnabled(enabled);
      if (enabled || state === "granted" || state === "denied") {
        handleDismissBanner();
      }
    } catch (err) {
      console.warn("Error subscribing push:", err);
      handleDismissBanner();
    }
  };

  // Delete notification click handler
  const handleDeleteClick = async (e: React.MouseEvent, notifId: string) => {
    e.stopPropagation(); // Prevent trigger of card click navigation
    if (onDeleteNotification) {
      onDeleteNotification(notifId);
    }
    try {
      await dismissNotification(userId, notifId);
    } catch (err) {
      console.warn("Error dismissing notification:", err);
    }
  };

  // Clear all notifications handler
  const handleClearAllManual = async () => {
    const allIds = notifications.map(n => n.id);
    if (onClearAllNotifications) {
      onClearAllNotifications();
    }
    try {
      await dismissAllNotifications(userId, allIds);
    } catch (err) {
      console.warn("Error dismissing all notifications in DB:", err);
    }
  };

  return (
    <div className="relative inline-block" ref={dropdownRef} id="notification-bell-container">
      {/* Target Bell Trigger Button */}
      <button
        onClick={handleToggleOpen}
        className="relative p-2 rounded-xl bg-white/5 border border-white/10 hover:border-white/20 transition-all flex items-center justify-center text-white/80 hover:text-white"
        title="Notifications"
        id="notification-bell-btn"
      >
        {unreadCount > 0 ? (
          <BellRing size={20} className="text-[#c9a96e] animate-pulse" />
        ) : (
          <Bell size={20} />
        )}

        {unreadCount > 0 && (
          <span
            className="absolute -top-1 -right-1 bg-[#c9a96e] text-black text-[9px] font-extrabold rounded-full w-[18px] h-[18px] flex items-center justify-center border border-black shadow"
            id="notification-unread-badge"
          >
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {/* Notifications Dropdown Panel */}
      {isOpen && (
        <div
          className="fixed inset-x-0 bottom-0 top-[60px] sm:absolute sm:right-0 sm:top-12 sm:bottom-auto sm:inset-x-auto w-full sm:w-[340px] max-h-[80vh] sm:max-h-[500px] flex flex-col bg-black/95 backdrop-blur-2xl border-t sm:border border-white/10 sm:rounded-2xl shadow-xl z-[9999] overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200"
          id="notification-dropdown-panel"
        >
          {/* Header Panel */}
          <div className="p-4 border-b border-white/5 flex items-center justify-between shrink-0">
            <h4 className="font-serif text-white font-medium text-lg leading-none">Notifications</h4>
            <div className="flex items-center gap-3">
              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAllReadManual}
                  className="text-[#c9a96e] hover:text-[#c9a96e]/80 text-[11px] font-bold tracking-wider uppercase transition-colors"
                  id="notif-mark-all-read"
                >
                  Mark all read
                </button>
              )}
              {notifications.length > 0 && (
                <button
                  onClick={handleClearAllManual}
                  className="text-white/40 hover:text-red-400 text-[11px] font-bold tracking-wider uppercase transition-colors"
                  id="notif-clear-all"
                >
                  Clear all
                </button>
              )}
              <button
                onClick={() => setIsOpen(false)}
                className="p-1 rounded-lg hover:bg-white/5 transition-colors text-white/40 hover:text-white"
                id="notif-close-panel"
              >
                <X size={16} />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
            {/* Push Banner Subscription Notice */}
            {!pushEnabled && !bannerDismissed && permissionState !== "denied" && (
              <div
                className="mb-4 bg-[#c9a96e]/10 border border-[#c9a96e]/20 rounded-xl p-3.5 text-left relative"
                id="push-enable-banner"
              >
                <button
                  onClick={handleDismissBanner}
                  className="absolute top-2.5 right-2.5 text-white/40 hover:text-white/80 p-1 rounded-md transition-colors"
                  title="Dismiss notice"
                  id="push-dismiss-btn"
                >
                  <X size={13} />
                </button>
                <div className="flex items-start gap-2.5 pr-6">
                  <div className="p-1.5 rounded-lg bg-[#c9a96e]/10 text-[#c9a96e] shrink-0 mt-0.5">
                    <Bell size={14} />
                  </div>
                  <div className="space-y-1">
                    <h5 className="text-[#c9a96e] text-xs font-bold leading-tight uppercase tracking-wider">Keep updated</h5>
                    <p className="text-white/70 text-[10.5px] leading-relaxed">
                      Enable push notifications to receive real-time updates of event invitations and announcements.
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleEnablePush}
                  className="mt-2.5 w-full bg-[#c9a96e] hover:bg-[#c9a96e]/90 text-black font-extrabold text-[10px] uppercase tracking-wider py-1.5 px-3 rounded-lg transition-all"
                  id="push-enable-btn"
                >
                  Enable Notifications
                </button>
              </div>
            )}

            {/* List State Render */}
            {notifications.length === 0 ? (
              <div className="py-12 text-center" id="notifications-empty-state">
                <div className="w-12 h-12 rounded-full bg-white/5 text-white/20 flex items-center justify-center mx-auto mb-4">
                  <Bell size={24} />
                </div>
                <h5 className="text-white/60 font-medium text-sm mb-1">No notifications yet</h5>
                <p className="text-white/30 text-xs max-w-[200px] mx-auto leading-relaxed">
                  You'll be notified about private events, boutique bookings, and exclusive club announcements.
                </p>
              </div>
            ) : (
              <div className="space-y-2.5" id="notifications-list-wrapper">
                {notifications.map((notif) => {
                  const icon = NOTIFICATION_ICONS[notif.type] || "🔔";
                  return (
                    <div
                      key={notif.id}
                      onClick={() => handleNotificationClick(notif)}
                      className={`relative rounded-xl p-3.5 border border-white/5 transition-all text-left flex gap-3.5 cursor-pointer block hover:bg-white/5 group ${
                        notif.read
                          ? "bg-transparent border-transparent"
                          : "bg-white/5 border-l-2 border-l-[#c9a96e]"
                      }`}
                      id={`notification-row-${notif.id}`}
                    >
                      <div className="text-2xl shrink-0 mt-0.5" id={`notif-icon-${notif.id}`}>
                        {icon}
                      </div>

                      <div className="space-y-0.5 min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <h5 className="font-serif text-white font-medium text-xs break-words whitespace-normal">
                            {notif.title}
                          </h5>
                          {!notif.read && (
                            <span className="w-1.5 h-1.5 rounded-full bg-[#c9a96e] shrink-0 mt-1"></span>
                          )}
                        </div>
                        <p className="text-white/60 text-[11px] leading-relaxed break-words">
                          {notif.message}
                        </p>
                        <span className="text-[9px] text-white/30 block pt-1 font-mono pr-8">
                          {formatTimeAgo(notif.created_at)}
                        </span>
                      </div>

                      {/* Delete notification button */}
                      <button
                        onClick={(e) => handleDeleteClick(e, notif.id)}
                        className="absolute bottom-2 right-2 p-1.5 rounded-lg bg-transparent hover:bg-white/10 text-white/40 hover:text-red-400/90 transition-all cursor-pointer opacity-0 group-hover:opacity-100 sm:opacity-100"
                        title="Delete Notification"
                        id={`delete-notif-btn-${notif.id}`}
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
