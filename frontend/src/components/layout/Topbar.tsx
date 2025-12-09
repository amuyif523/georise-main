import type { FC } from "react";

const Topbar: FC<{ title?: string; onToggleMenu?: () => void }> = ({ title }) => {
  return (
    <div className="p-4 flex justify-between items-center border-b border-slate-800 bg-[#0A0F1A]">
      <h1 className="text-xl font-bold text-slate-100">{title || "GEORISE"}</h1>
    </div>
  );
};

export default Topbar;
