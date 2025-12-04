import React from "react";
import { Link } from "react-router-dom";
import { List, MapPin, Plus } from "lucide-react";
import { useAuth } from "../context/AuthContext";

const CitizenDashboard: React.FC = () => {
  const { user, logout } = useAuth();
  return (
    <div className="min-h-screen bg-[#0A0F1A] text-slate-100 pt-16 pb-12">
      <div className="max-w-5xl mx-auto px-4">
        <div className="flex justify-between items-center mb-8">
          <div>
            <p className="text-sm text-cyan-200">Citizen workspace</p>
            <h1 className="text-3xl font-bold">Welcome, {user?.fullName}</h1>
            <p className="text-slate-400 text-sm">
              Report incidents and track your submissions in one place.
            </p>
          </div>
          <button className="btn btn-outline btn-sm" onClick={logout}>
            Logout
          </button>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <Link
            to="/citizen/report"
            className="p-6 rounded-xl border border-slate-800 bg-[#0D1117] shadow-lg shadow-cyan-500/10 hover:border-cyan-500 transition"
          >
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-full bg-cyan-500/10 text-cyan-300">
                <Plus size={20} />
              </div>
              <div>
                <h3 className="text-xl font-semibold text-white">Report an incident</h3>
                <p className="text-slate-400 text-sm">3-step wizard with map selection.</p>
              </div>
            </div>
          </Link>

          <Link
            to="/citizen/my-reports"
            className="p-6 rounded-xl border border-slate-800 bg-[#0D1117] shadow-lg shadow-cyan-500/10 hover:border-cyan-500 transition"
          >
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-full bg-emerald-500/10 text-emerald-300">
                <List size={20} />
              </div>
              <div>
                <h3 className="text-xl font-semibold text-white">My reports</h3>
                <p className="text-slate-400 text-sm">
                  View status, AI category, and severity.
                </p>
              </div>
            </div>
          </Link>
        </div>

        <div className="mt-6 p-4 rounded-lg border border-slate-800 bg-slate-900/40 flex items-center gap-3 text-sm text-slate-300">
          <MapPin size={18} className="text-cyan-300" />
          Select your location accurately in the wizard to help responders move faster.
        </div>
      </div>
    </div>
  );
};

export default CitizenDashboard;
