import type { ReactNode } from "react";
import { motion } from "framer-motion";
import { LogOut } from "lucide-react";
import { useAuth } from "../context/AuthContext";

interface Props {
  children: ReactNode;
  title?: string;
}

export default function CitizenLayout({ children, title }: Props) {
  const { logout, user } = useAuth();

  return (
    <div data-theme="georiseCitizen" className="min-h-screen bg-slate-50 text-slate-900">
      <header className="w-full border-b border-slate-200 bg-white/90 backdrop-blur sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold text-sm">
              G
            </div>
            <div className="flex flex-col">
              <span className="font-semibold text-slate-900">GEORISE Citizen</span>
              <span className="text-[10px] uppercase tracking-[0.15em] text-slate-400">
                Addis Ababa Safety Portal
              </span>
            </div>
          </div>
          <div className="flex items-center gap-3 text-xs text-slate-500">
            {user && (
              <span className="hidden sm:inline">
                Logged in as <span className="font-medium text-slate-700">{user.fullName}</span>
              </span>
            )}
            <button
              onClick={logout}
              className="btn btn-xs btn-ghost gap-1 text-slate-600 hover:text-red-600"
            >
              <LogOut className="w-4 h-4" />
              Logout
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6">
        {title && (
          <div className="mb-4">
            <p className="page-section-title">Citizen Portal</p>
            <h1 className="text-2xl font-semibold text-slate-900">{title}</h1>
          </div>
        )}

        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-4"
        >
          {children}
        </motion.div>
      </main>
    </div>
  );
}
