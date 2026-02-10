import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  Map,
  Activity,
  Shield,
  Home,
  Users,
  LayoutDashboard,
  Bell,
  Radio,
  BarChart3,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

const NavItem: React.FC<{ to: string; icon: React.ReactNode; label: string }> = ({
  to,
  icon,
  label,
}) => {
  const { pathname } = useLocation();
  const active = pathname.startsWith(to);
  return (
    <Link
      to={to}
      className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition
      ${active ? 'border-cyan-500/60 bg-cyan-500/10 shadow-[0_0_12px_rgba(34,211,238,0.35)]' : 'border-slate-800 hover:border-cyan-500/40 hover:bg-slate-900'}`}
    >
      <span className="text-cyan-300">{icon}</span>
      <span className="text-sm">{label}</span>
    </Link>
  );
};

const AppSidebar: React.FC = () => {
  const { user } = useAuth();
  const { t } = useTranslation();
  const role = user?.role;
  const [open, setOpen] = React.useState(false);

  const items =
    role === 'ADMIN'
      ? [
          { to: '/admin', icon: <LayoutDashboard size={16} />, label: t('nav.dashboard') },
          { to: '/admin/agencies', icon: <Shield size={16} />, label: t('nav.agencies') },
          { to: '/admin/users', icon: <Users size={16} />, label: t('nav.users') },
          { to: '/admin/verification', icon: <Shield size={16} />, label: t('nav.verification') },
          { to: '/admin/review', icon: <Bell size={16} />, label: t('nav.review') },
          { to: '/admin/activity', icon: <Radio size={16} />, label: t('nav.activity') },
          { to: '/admin/analytics', icon: <BarChart3 size={16} />, label: t('analytics.title') },
        ]
      : role === 'AGENCY_STAFF'
        ? [
            { to: '/agency', icon: <LayoutDashboard size={16} />, label: t('nav.dashboard') },
            { to: '/agency/map', icon: <Map size={16} />, label: t('nav.map') },
            { to: '/agency/analytics', icon: <BarChart3 size={16} />, label: t('analytics.title') },
          ]
        : [
            { to: '/citizen', icon: <Home size={16} />, label: t('nav.home') },
            { to: '/citizen/report', icon: <Activity size={16} />, label: t('nav.report') },
            { to: '/citizen/my-reports', icon: <Shield size={16} />, label: t('nav.history') },
            { to: '/citizen/verify', icon: <Shield size={16} />, label: t('nav.verify') },
          ];

  return (
    <>
      <button
        className="md:hidden fixed top-3 left-3 z-50 btn btn-ghost btn-xs border border-slate-800"
        onClick={() => setOpen((v) => !v)}
      >
        ☰
      </button>
      <aside
        className={`w-56 border-r border-slate-800 bg-[#0D1117] flex-col p-3 gap-2 z-40 transition-transform duration-200 ${
          open ? 'translate-x-0' : '-translate-x-full'
        } md:translate-x-0 md:flex`}
      >
        <div className="px-2 py-3">
          <div className="text-xs uppercase text-cyan-300 tracking-wide">GEORISE</div>
          <div className="text-sm text-slate-400">Command Center</div>
        </div>
        <nav className="flex flex-col gap-2">
          {items.map((i) => (
            <NavItem key={i.to} {...i} />
          ))}
        </nav>
      </aside>
    </>
  );
};

export default AppSidebar;
