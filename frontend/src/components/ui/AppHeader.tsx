import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import NotificationBell from '../ui/NotificationBell';
import NotificationToggle from '../ui/NotificationToggle';
import LanguageSwitcher from '../LanguageSwitcher';

const AppHeader: React.FC = () => {
  const { user, logout } = useAuth();
  const online = typeof navigator !== 'undefined' ? navigator.onLine : true;
  const [offline, setOffline] = useState(!online);

  useEffect(() => {
    const on = () => setOffline(false);
    const off = () => setOffline(true);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);

  return (
    <header className="flex items-center justify-between px-4 py-3 border-b border-slate-800 bg-[#0D1117]/80 backdrop-blur">
      <div className="flex items-center gap-2">
        <div className={`w-2 h-2 rounded-full ${offline ? 'bg-yellow-400' : 'bg-emerald-400'}`} />
        <span className="text-xs text-slate-400">
          {offline ? 'Offline (fallback to polling)' : 'Online'}
        </span>
      </div>
      <div className="flex items-center gap-3">
        <LanguageSwitcher />
        <NotificationToggle />
        <NotificationBell />
        <div className="flex items-center gap-2 text-sm">
          <span className="text-slate-200">{user?.fullName}</span>
          <span className="text-[11px] px-2 py-1 rounded-full border border-slate-700 bg-slate-900 text-cyan-200">
            {user?.role}
          </span>
        </div>
        <button className="btn btn-ghost btn-xs text-slate-300" onClick={logout}>
          Logout
        </button>
      </div>
    </header>
  );
};

export default AppHeader;
