import React from 'react';

const SkeletonMap: React.FC<{ label?: string }> = ({ label = 'Locating...' }) => {
  return (
    <div className="relative h-full w-full overflow-hidden bg-slate-900">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(148,163,184,0.18),transparent_22%),radial-gradient(circle_at_75%_30%,rgba(148,163,184,0.14),transparent_24%),linear-gradient(135deg,rgba(15,23,42,0.95),rgba(30,41,59,0.92))]" />
      <div className="absolute inset-0 opacity-30 [background-size:32px_32px] [background-image:linear-gradient(to_right,rgba(148,163,184,0.18)_1px,transparent_1px),linear-gradient(to_bottom,rgba(148,163,184,0.18)_1px,transparent_1px)]" />
      <div className="absolute inset-0 animate-pulse bg-gradient-to-br from-slate-400/5 via-transparent to-cyan-400/10" />
      <div className="absolute inset-x-0 bottom-4 flex justify-center">
        <div className="rounded-full border border-slate-600 bg-slate-950/85 px-4 py-2 text-xs font-medium text-slate-200 shadow-lg backdrop-blur">
          <span className="loading loading-spinner loading-xs mr-2 align-[-1px]" />
          {label}
        </div>
      </div>
    </div>
  );
};

export default SkeletonMap;
