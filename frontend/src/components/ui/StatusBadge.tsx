import React from 'react';

const severityColors: Record<'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'NONE', string> = {
  CRITICAL:
    'bg-rose-700/30 text-rose-100 border-rose-500/60 shadow-[0_0_20px_rgba(251,113,133,0.55)] animate-pulse',
  HIGH: 'bg-red-600/25 text-red-200 border-red-500/50 shadow-[0_0_18px_rgba(248,113,113,0.55)]',
  MEDIUM:
    'bg-orange-600/20 text-orange-300 border-orange-500/40 shadow-[0_0_10px_rgba(249,115,22,0.35)]',
  LOW: 'bg-cyan-600/20 text-cyan-300 border-cyan-500/40 shadow-[0_0_8px_rgba(34,211,238,0.35)]',
  NONE: 'bg-slate-700/30 text-slate-300 border-slate-600',
};

export const StatusBadge: React.FC<{ severity?: number | null; label?: string }> = ({
  severity,
  label,
}) => {
  const level =
    severity == null
      ? 'NONE'
      : severity >= 5
        ? 'CRITICAL'
        : severity >= 4
          ? 'HIGH'
          : severity >= 3
            ? 'MEDIUM'
            : 'LOW';
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] border ${severityColors[level]}`}
    >
      <span className="w-2 h-2 rounded-full bg-current opacity-80" />
      {label ?? `Sev ${severity ?? 'N/A'}`}
    </span>
  );
};

export default StatusBadge;
