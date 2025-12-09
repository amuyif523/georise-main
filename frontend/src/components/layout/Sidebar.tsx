import { NavLink } from "react-router-dom";
import { Shield, Map, User, Settings, PlayCircle } from "lucide-react";

const menu = [
  { to: "/citizen", label: "Citizen", icon: User },
  { to: "/agency", label: "Agency", icon: Map },
  { to: "/admin", label: "Admin", icon: Settings },
  { to: "/admin/demo", label: "Demo Control", icon: PlayCircle },
];

export default function Sidebar() {
  return (
    <div className="hidden md:flex h-screen w-64 flex-col bg-[#0D1117] border-r border-slate-800">
      <div className="flex items-center gap-2 p-4 border-b border-slate-800">
        <Shield className="w-6 h-6 text-blue-400" />
        <span className="font-bold">GEORISE</span>
      </div>

      <div className="flex-1 space-y-1 mt-4">
        {menu.map((m) => (
          <NavLink
            key={m.to}
            to={m.to}
            className={({ isActive }) =>
              `flex items-center gap-3 p-3 hover:bg-slate-800 transition ${
                isActive ? "text-blue-400 bg-slate-900" : "text-slate-300"
              }`
            }
          >
            <m.icon className="w-5 h-5 opacity-80" />
            {m.label}
          </NavLink>
        ))}
      </div>
    </div>
  );
}
