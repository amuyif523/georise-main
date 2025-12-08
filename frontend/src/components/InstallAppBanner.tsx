import React from "react";
import { useInstallPrompt } from "../hooks/useInstallPrompt";

const InstallAppBanner: React.FC = () => {
  const { canInstall, promptInstall } = useInstallPrompt();

  if (!canInstall) return null;

  return (
    <div className="fixed bottom-4 inset-x-4 z-50">
      <div className="bg-[#0B1120] border border-cyan-500/40 rounded-lg p-3 flex items-center justify-between shadow-xl">
        <div className="text-xs text-slate-200">
          <div className="font-semibold text-cyan-300">Install GEORISE</div>
          <div className="text-[10px] text-slate-400">Add GEORISE to your home screen for faster access and offline use.</div>
        </div>
        <button className="btn btn-xs btn-primary" onClick={promptInstall}>
          Install
        </button>
      </div>
    </div>
  );
};

export default InstallAppBanner;
