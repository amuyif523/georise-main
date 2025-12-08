import React, { useEffect } from "react";
import AppSidebar from "../components/ui/AppSidebar";
import AppHeader from "../components/ui/AppHeader";
import NetworkBanner from "../components/NetworkBanner";
import { useNetworkStatus } from "../hooks/useNetworkStatus";
import { syncIncidentQueue } from "../offline/incidentQueue";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const online = useNetworkStatus();

  useEffect(() => {
    if (online) {
      syncIncidentQueue().catch((err) => {
        console.error("Failed to sync offline incidents", err);
      });
    }
  }, [online]);

  return (
    <div className="flex h-screen bg-[#0A0F1A] text-slate-200 font-sans">
      <AppSidebar />
      <div className="flex-1 flex flex-col">
        <NetworkBanner />
        <AppHeader />
        <div className="flex-1 overflow-auto">{children}</div>
      </div>
    </div>
  );
}
