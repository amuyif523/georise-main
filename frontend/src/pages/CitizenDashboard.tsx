/* eslint-disable @typescript-eslint/no-explicit-any */
import React from "react";
import { Link } from "react-router-dom";
import { List, MapPin, Plus, ShieldCheck } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import TrustBadge from "../components/user/TrustBadge";
import PageWrapper from "../components/layout/PageWrapper";

const CitizenDashboard: React.FC = () => {
  const { user, logout } = useAuth();
  return (
    <PageWrapper title="Citizen Panel">
      <div className="grid lg:grid-cols-2 gap-6">
        <button
          className="btn btn-error w-full p-6 text-lg shadow-lg shadow-red-500/20"
          onClick={() => (window.location.href = "/citizen/report")}
        >
          🚨 Report Emergency
        </button>

        <div className="cyber-card">
          <div className="flex items-center gap-2 mb-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span className="text-sm text-slate-300">Identity</span>
          </div>
          <div className="flex items-center gap-2">
            <TrustBadge trustScore={(user as any)?.trustScore ?? 0} />
            <Link to="/citizen/verify" className="btn btn-xs btn-primary">
              Verify account
            </Link>
          </div>
        </div>

        <div className="cyber-card">
          <h2 className="font-bold mb-2">Nearby Alerts</h2>
          <p className="text-sm text-slate-400">No alerts in your area.</p>
        </div>

        <div className="cyber-card">
          <div className="flex items-center gap-2 mb-3">
            <Plus size={18} className="text-cyan-300" />
            <h3 className="text-lg font-semibold">Quick actions</h3>
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <Link to="/citizen/report" className="btn btn-primary btn-sm w-full">
              New report
            </Link>
            <Link to="/citizen/my-reports" className="btn btn-outline btn-sm w-full">
              My reports
            </Link>
          </div>
          <div className="mt-3 text-xs text-slate-400 flex items-center gap-2">
            <MapPin size={14} /> Accurate location speeds response.
          </div>
        </div>

        <div className="cyber-card col-span-full">
          <div className="flex items-center gap-2 mb-3">
            <List size={18} className="text-cyan-300" />
            <h2 className="font-bold">My Reports</h2>
          </div>
          <p className="text-sm text-slate-400">View status, AI category, and severity.</p>
          <Link to="/citizen/my-reports" className="btn btn-xs btn-outline mt-3">
            Open reports
          </Link>
        </div>
      </div>
    </PageWrapper>
  );
};

export default CitizenDashboard;
