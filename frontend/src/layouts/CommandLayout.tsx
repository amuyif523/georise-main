import type { ReactNode } from "react";
import { motion } from "framer-motion";
import { Shield, Activity, Map, BarChart3, LogOut } from "lucide-react";
import { NavLink } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

interface Props {
  children: ReactNode;
  title?: string;
  subtitle?: string;
}

export default function CommandLayout({ children, title, subtitle }: Props) {
  const { logout, user } = useAuth();

  const navItems = [
    { label: "Dashboard", to: "/agency", icon: Activity },
    { label: "Map & Incidents", to: "/agency/map", icon: Map },
    { label: "Analytics", to: "/agency/analytics", icon: BarChart3 },
  ];

  return (
    <div data-theme="georiseCommand" className="min-h-screen bg-[#020617] text-slate-100 flex">
      <aside className="hidden md:flex flex-col w-60 border-r border-slate-800 bg-[#020617]/95">
        <div className="px-4 py-4 border-b border-slate-800 flex items-center gap-2">
          <Shield className="w-6 h-6 text-blue-500" />
          <div>
            <div className="font-semibold text-sm">GEORISE Command</div>
            <div className="text-[10px] text-slate-500 uppercase tracking-[0.15em]">
              Agency Console
            </div>
          </div>
        </div>
        <nav className="flex-1 px-2 py-4 space-y-1">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex items-center gap-2 px-3 py-2 rounded-md text-sm transition
                ${
                  isActive
                    ? "bg-blue-600/20 text-blue-300 border border-blue-600/40"
                    : "text-slate-400 hover:bg-slate-800/70"
                }`
              }
            >
              <item.icon className="w-4 h-4" />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="px-3 py-3 border-t border-slate-800 flex items-center justify-between text-xs text-slate-500">
          <span className="truncate max-w-[120px]">
            {user?.fullName ?? "Agency User"}
          </span>
          <button onClick={logout} className="flex items-center gap-1 hover:text-red-400">
            <LogOut className="w-3 h-3" />
            Logout
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col">
        <header className="h-14 border-b border-slate-800 flex items-center justify-between px-4 bg-[#020617]/90 backdrop-blur">
          <div>
            {title && <h1 className="text-base md:text-lg font-semibold text-slate-100">{title}</h1>}
            {subtitle && <p className="text-[11px] text-slate-500 mt-0.5">{subtitle}</p>}
          </div>
          <div className="text-[11px] text-slate-500 font-mono hidden sm:block">
            GEORISE v1.0 · Addis Ababa
          </div>
        </header>

        <main className="flex-1 p-4 md:p-6 overflow-y-auto">
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-4"
          >
            {children}
          </motion.div>
        </main>
      </div>
    </div>
  );
}
