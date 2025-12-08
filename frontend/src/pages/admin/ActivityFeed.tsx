/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useEffect, useState } from "react";
import AppLayout from "../../layouts/AppLayout";
import { getSocket } from "../../lib/socket";

type ActivityItem = {
  id: string;
  type: string;
  incidentId: number;
  category: string | null;
  status: string | null;
  createdAt: string;
};

const ActivityFeed: React.FC = () => {
  const [events, setEvents] = useState<ActivityItem[]>([]);

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;
    const pushEvent = (type: string, incident: any) => {
      setEvents((prev) => [
        {
          id: `${type}-${incident.id}-${Date.now()}`,
          type,
          incidentId: incident.id,
          category: incident.category,
          status: incident.status,
          createdAt: new Date().toISOString(),
        },
        ...prev.slice(0, 50),
      ]);
    };
    const createdHandler = (inc: any) => pushEvent("CREATED", inc);
    const updatedHandler = (inc: any) => pushEvent("UPDATED", inc);
    socket.on("incident:created", createdHandler);
    socket.on("incident:updated", updatedHandler);
    socket.on("disconnect", () => {
      // add warning entry
      setEvents((prev) => [
        { id: `disc-${Date.now()}`, type: "DISCONNECTED", incidentId: 0, category: null, status: "N/A", createdAt: new Date().toISOString() },
        ...prev,
      ]);
    });
    return () => {
      socket?.off("incident:created", createdHandler);
      socket?.off("incident:updated", updatedHandler);
      socket?.off("disconnect");
    };
  }, []);

  return (
    <AppLayout>
      <div className="p-6 space-y-4">
        <div>
          <p className="text-sm text-cyan-200">Admin</p>
          <h1 className="text-2xl font-bold">Live Activity Feed</h1>
        </div>
        <div className="space-y-2">
          {events.map((e) => (
            <div
              key={e.id}
              className="p-3 rounded-lg border border-slate-800 bg-[#0D1117] flex justify-between text-sm"
            >
              <div>
                <span className="text-cyan-300 mr-2">{e.type}</span>
                Incident #{e.incidentId} — {e.category || "N/A"} — {e.status}
              </div>
              <div className="text-xs text-slate-500">{new Date(e.createdAt).toLocaleTimeString()}</div>
            </div>
          ))}
        </div>
      </div>
    </AppLayout>
  );
};

export default ActivityFeed;
