import React from "react";
import AppSidebar from "../components/ui/AppSidebar";
import AppHeader from "../components/ui/AppHeader";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen bg-[#0A0F1A] text-slate-200 font-sans">
      <AppSidebar />
      <div className="flex-1 flex flex-col">
        <AppHeader />
        <div className="flex-1 overflow-auto">{children}</div>
      </div>
    </div>
  );
}
