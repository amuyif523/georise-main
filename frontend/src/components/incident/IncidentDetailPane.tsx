import React from "react";
import StatusBadge from "../ui/StatusBadge";

type Incident = {
  id: number;
  title: string;
  description?: string | null;
  category?: string | null;
  severityScore?: number | null;
  status?: string;
  createdAt?: string;
};

type Props = {
  incident: Incident | null;
  onClose: () => void;
  onAssign?: () => void;
  onRespond?: () => void;
  onResolve?: () => void;
};

const IncidentDetailPane: React.FC<Props> = ({ incident, onClose, onAssign, onRespond, onResolve }) => {
  return (
    <div
      className={`fixed lg:static right-0 top-0 h-full w-full lg:w-96 bg-[#0D1117] border-l border-slate-800 shadow-2xl transition-transform duration-300 ${
        incident ? "translate-x-0" : "translate-x-full lg:translate-x-0"
      }`}
    >
      <div className="flex items-center justify-between p-4 border-b border-slate-800">
        <div className="text-sm text-slate-300">Incident Detail</div>
        <button className="btn btn-ghost btn-xs" onClick={onClose}>
          Close
        </button>
      </div>
      {incident ? (
        <div className="p-4 space-y-3">
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="text-lg font-semibold text-white">{incident.title}</div>
              <div className="text-xs text-slate-400">
                {incident.category || "Uncategorized"} • {incident.status || "NEW"}
              </div>
            </div>
            <StatusBadge severity={incident.severityScore} />
          </div>
          {incident.description && (
            <p className="text-sm text-slate-300 leading-relaxed">{incident.description}</p>
          )}
          <div className="text-xs text-slate-500">
            {incident.createdAt && new Date(incident.createdAt).toLocaleString()}
          </div>
          <div className="flex flex-wrap gap-2 pt-2">
            {onAssign && (
              <button className="btn btn-xs" onClick={onAssign}>
                Assign
              </button>
            )}
            {onRespond && (
              <button className="btn btn-xs btn-primary" onClick={onRespond}>
                Responding
              </button>
            )}
            {onResolve && (
              <button className="btn btn-xs btn-success" onClick={onResolve}>
                Resolve
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="p-4 text-slate-400 text-sm">Select an incident to view details.</div>
      )}
    </div>
  );
};

export default IncidentDetailPane;
