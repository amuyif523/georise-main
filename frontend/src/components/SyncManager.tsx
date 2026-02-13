import React, { useEffect } from 'react';
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import { syncIncidentQueue } from '../offline/incidentQueue';
import { useSystem } from '../context/SystemContext';

const SyncManager: React.FC = () => {
  const isOnline = useNetworkStatus();
  const { setIsSyncing } = useSystem();

  useEffect(() => {
    if (isOnline) {
      console.log('Online detected, starting sync...');
      setIsSyncing(true);
      syncIncidentQueue()
        .then((results) => {
          const successCount = results.filter((r) => r.success).length;
          if (successCount > 0) {
            console.log(`Successfully synced ${successCount} queued incidents.`);
          }
        })
        .finally(() => {
          setIsSyncing(false);
        });
    }
  }, [isOnline, setIsSyncing]);

  return null;
};

export default SyncManager;
