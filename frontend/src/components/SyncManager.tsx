import React, { useEffect, useState } from 'react';
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import { syncIncidentQueue } from '../offline/incidentQueue';
import { useSystem } from '../context/SystemContext';
import { useAuth } from '../context/AuthContext';

const SyncManager: React.FC = () => {
  const isOnline = useNetworkStatus();
  const { setIsSyncing } = useSystem();
  const { user } = useAuth();
  const [syncNotice, setSyncNotice] = useState<string | null>(null);

  useEffect(() => {
    if (isOnline) {
      console.log('Online detected, starting sync...');
      setIsSyncing(true);
      syncIncidentQueue()
        .then((results) => {
          const successCount = results.filter((r) => r.success).length;
          if (successCount > 0) {
            console.log(`Successfully synced ${successCount} queued incidents.`);
            if (user?.role === 'CITIZEN') {
              setSyncNotice(
                successCount === 1
                  ? 'Synced 1 queued report.'
                  : `Synced ${successCount} queued reports.`,
              );
            }
          }
        })
        .finally(() => {
          setIsSyncing(false);
        });
    }
  }, [isOnline, setIsSyncing, user?.role]);

  useEffect(() => {
    if (!syncNotice) return;
    const timer = window.setTimeout(() => {
      setSyncNotice(null);
    }, 4500);
    return () => window.clearTimeout(timer);
  }, [syncNotice]);

  if (!syncNotice) return null;

  return (
    <div className="fixed top-16 left-1/2 z-[2000] -translate-x-1/2">
      <div className="alert alert-success py-2 px-4 text-xs shadow-lg">{syncNotice}</div>
    </div>
  );
};

export default SyncManager;
