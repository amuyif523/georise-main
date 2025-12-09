import { LogOut, Menu } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import React from "react";

export default function Topbar({ title, onToggleMenu }: { title: string; onToggleMenu?: () => void }) {
  const { user, logout } = useAuth();

  return (
    <div className="p-4 flex justify-between items-center border-b border-slate-800 bg-[#0A0F1A] sticky top-0 z-30">
      <div className="flex items-center gap-2">
        <button className="md:hidden btn btn-square btn-ghost btn-sm" onClick={onToggleMenu}>
          <Menu className="w-4 h-4" />
        </button>
        <h1 className="text-xl font-bold">{title}</h1>
      </div>
      {user && (
        <button className="btn btn-sm btn-outline" onClick={logout}>
          <LogOut className="w-4 h-4 mr-1" /> Logout
        </button>
      )}
    </div>
  );
}
