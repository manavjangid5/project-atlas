import { useEffect, useState, useRef } from "react";
import { api } from "../../lib/api";
import { getSocket } from "../../lib/socket";
import { useAuthStore } from "../../store/authStore";

interface Notification {
  id: string;
  title: string;
  message: string;
  priority: string;
  readAt: string | null;
  createdAt: string;
}

export default function NotificationBell() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);
  const activeOrgId = useAuthStore((s) => s.activeOrgId);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const unreadCount = notifications.filter((n) => !n.readAt).length;

  useEffect(() => {
  api.get("/notifications").then((res) => setNotifications(res.data));

  const socket = getSocket();
  if (!socket.connected) socket.connect();

  socket.on("authenticated", ({ ok }: { ok: boolean }) => {
    if (ok && activeOrgId) socket.emit("join-org", activeOrgId);
  });

  function handleNew(notification: Notification) {
    setNotifications((prev) => [notification, ...prev]);
  }
  socket.on("notification", handleNew);

  return () => {
    socket.off("notification", handleNew);
    socket.off("authenticated");
  };
    }, [activeOrgId]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  async function handleMarkAllRead() {
    await api.post("/notifications/read-all");
    setNotifications((prev) => prev.map((n) => ({ ...n, readAt: new Date().toISOString() })));
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button onClick={() => setOpen(!open)} className="relative p-2 text-muted hover:text-text">
        🔔
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 bg-accent text-white text-[10px] rounded-full w-4 h-4 flex items-center justify-center">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 bg-surface border border-border rounded-md shadow-xl z-50">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <h3 className="text-sm font-semibold">Notifications</h3>
            {unreadCount > 0 && (
              <button onClick={handleMarkAllRead} className="text-xs text-accent hover:underline">
                Mark all read
              </button>
            )}
          </div>
          <div className="max-h-96 overflow-auto">
            {notifications.length === 0 ? (
              <p className="text-xs text-muted p-4">No notifications yet.</p>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id}
                  className={`px-4 py-3 border-b border-border ${!n.readAt ? "bg-accent/5" : ""}`}
                >
                  <p className="text-sm font-medium">{n.title}</p>
                  <p className="text-xs text-muted mt-0.5">{n.message}</p>
                  <p className="text-xs text-muted mt-1">{new Date(n.createdAt).toLocaleTimeString()}</p>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}