import React from "react";
import { useAuth } from "../../context/AuthContext";
import { BellDot, WifiOff, Wifi } from "lucide-react";

const AppHeader: React.FC = () => {
  const { user, logout } = useAuth();
  const online = typeof navigator !== "undefined" ? navigator.onLine : true;
  return (
    <header className="flex items-center justify-between px-4 py-3 border-b border-slate-800 bg-[#0D1117]/80 backdrop-blur">
      <div className="flex items-center gap-2">
        <div className={`w-2 h-2 rounded-full ${online ? "bg-emerald-400" : "bg-yellow-400"}`} />
        <span className="text-xs text-slate-400">
          {online ? "Online" : "Offline — actions will sync"}
        </span>
      </div>
      <div className="flex items-center gap-3">
        <div className="relative">
          <BellDot className="text-cyan-300" size={18} />
          <span className="absolute top-0 right-0 w-2 h-2 bg-red-500 rounded-full animate-ping" />
        </div>
        <div className="flex items-center gap-2 text-sm">
          <span className="text-slate-200">{user?.fullName}</span>
          <span className="text-[11px] px-2 py-1 rounded-full border border-slate-700 bg-slate-900 text-cyan-200">
            {user?.role}
          </span>
        </div>
        <button className="btn btn-ghost btn-xs text-slate-300" onClick={logout}>
          Logout
        </button>
      </div>
    </header>
  );
};

export default AppHeader;
