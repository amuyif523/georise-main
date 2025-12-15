import React from "react";
import { useSystem } from "../context/SystemContext";
import { AlertTriangle } from "lucide-react";

const CrisisBanner: React.FC = () => {
  const { crisisMode } = useSystem();

  if (!crisisMode) return null;

  return (
    <div className="bg-red-600 text-white px-4 py-2 flex items-center justify-center gap-2 animate-pulse font-bold z-50 relative shadow-lg">
      <AlertTriangle size={20} />
      <span>CRISIS MODE ACTIVE: Emergency protocols in effect. Please keep lines clear for life-threatening emergencies.</span>
    </div>
  );
};

export default CrisisBanner;
