import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import NotificationBell from '../ui/NotificationBell';
import NotificationToggle from '../ui/NotificationToggle';
import LanguageSwitcher from '../LanguageSwitcher';
import { useSystem } from '../../context/SystemContext';
import { Loader2 } from 'lucide-react';

const AppHeader: React.FC = () => {
  const { user, logout } = useAuth();
  const { isAiProcessing, isSyncing } = useSystem();
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

  const showLoader = isAiProcessing || isSyncing;

  return (
    <header className="relative z-50 flex items-center justify-between px-4 py-3 border-b border-slate-800 bg-[#0D1117]/80 backdrop-blur">
      <div className="flex items-center gap-2">
        <div className={`w-2 h-2 rounded-full ${offline ? 'bg-yellow-400' : 'bg-emerald-400'}`} />
        <span className="text-xs text-slate-400">
          {offline ? 'Offline (fallback to polling)' : 'Online'}
        </span>
        {showLoader && (
          <div className="flex items-center gap-2 ml-4 px-2 py-1 bg-blue-500/10 rounded-full border border-blue-500/20">
            <Loader2 className="w-3 h-3 text-blue-400 animate-spin" />
            <span className="text-[10px] text-blue-300 font-mono uppercase tracking-wider">
              {isAiProcessing ? 'AI Processing' : 'Syncing'}
            </span>
          </div>
        )}
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
