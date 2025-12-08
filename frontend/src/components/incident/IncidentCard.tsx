import React from "react";
import StatusBadge from "../ui/StatusBadge";

type Props = {
  title: string;
  category?: string | null;
  severity?: number | null;
  status?: string;
  timestamp?: string;
  onClick?: () => void;
};

const IncidentCard: React.FC<Props> = ({ title, category, severity, status, timestamp, onClick }) => {
  return (
    <div
      className="p-3 rounded-xl border border-slate-800 bg-[#0D1117] hover:border-cyan-500/40 hover:shadow-[0_0_14px_rgba(34,211,238,0.25)] transition cursor-pointer"
      onClick={onClick}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="text-sm font-semibold text-white">{title}</div>
        <StatusBadge severity={severity} />
      </div>
      <div className="text-xs text-slate-400 flex items-center gap-2 mt-1">
        <span className="uppercase tracking-wide">{category || "Uncategorized"}</span>
        <span>•</span>
        <span>{status || "NEW"}</span>
      </div>
      {timestamp && (
        <div className="text-[11px] text-slate-500 mt-1">
          {new Date(timestamp).toLocaleString()}
        </div>
      )}
    </div>
  );
};

export default IncidentCard;
