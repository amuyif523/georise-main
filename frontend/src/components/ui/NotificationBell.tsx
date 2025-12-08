import React, { useEffect, useState } from "react";
import { BellDot } from "lucide-react";
import { getSocket } from "../../lib/socket";

type Notification = {
  id: string;
  message: string;
  ts: string;
  severity?: number | null;
};

const NotificationBell: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;
    const handler = (inc: any) => {
      const sev = inc.severityScore ?? null;
      const message =
        inc.status === "ASSIGNED"
          ? `Assigned: ${inc.title}`
          : inc.status === "RESPONDING"
            ? `Responding: ${inc.title}`
            : inc.status === "RESOLVED"
              ? `Resolved: ${inc.title}`
              : `Incident update: ${inc.title}`;
      const item: Notification = {
        id: `${inc.id}-${Date.now()}`,
        message,
        ts: new Date().toISOString(),
        severity: sev,
      };
      setNotifications((prev) => [item, ...prev].slice(0, 15));
      setUnread((prev) => prev + 1);
    };
    socket.on("incident:created", handler);
    socket.on("incident:updated", handler);
    return () => {
      socket.off("incident:created", handler);
      socket.off("incident:updated", handler);
    };
  }, []);

  const badgeColor = (sev?: number | null) => {
    if (sev == null) return "text-slate-300";
    if (sev >= 5) return "text-red-400";
    if (sev >= 3) return "text-orange-400";
    return "text-cyan-300";
  };

  return (
    <div className="relative">
      <button className="btn btn-ghost btn-xs" onClick={() => { setOpen((v) => !v); setUnread(0); }}>
        <BellDot className="text-cyan-300" size={18} />
        {unread > 0 && <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full animate-ping" />}
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-64 rounded-lg border border-slate-800 bg-[#0D1117] shadow-2xl p-2 z-40">
          <div className="text-xs text-slate-400 mb-2">Live notifications</div>
          <div className="space-y-1 max-h-64 overflow-auto">
            {notifications.length === 0 && (
              <div className="text-xs text-slate-500">No notifications yet.</div>
            )}
            {notifications.map((n) => (
              <div key={n.id} className="p-2 rounded border border-slate-800 bg-slate-900/60 text-xs text-slate-200">
                <div className={`font-semibold ${badgeColor(n.severity)}`}>{n.message}</div>
                <div className="text-[10px] text-slate-500">{new Date(n.ts).toLocaleTimeString()}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationBell;
