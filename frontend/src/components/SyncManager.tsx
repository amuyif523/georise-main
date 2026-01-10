import React, { useEffect } from 'react';
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import { syncIncidentQueue } from '../offline/incidentQueue';

const SyncManager: React.FC = () => {
    const isOnline = useNetworkStatus();

    useEffect(() => {
        if (isOnline) {
            console.log('Online detected, starting sync...');
            syncIncidentQueue().then((results) => {
                const successCount = results.filter((r) => r.success).length;
                if (successCount > 0) {
                    console.log(`Successfully synced ${successCount} queued incidents.`);
                }
            });
        }
    }, [isOnline]);

    return null;
};

export default SyncManager;
