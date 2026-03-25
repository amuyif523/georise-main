import React from 'react';
import { useNetworkStatus } from '../hooks/useNetworkStatus';

interface NetworkBannerProps {
  missionMapOfflineReady?: boolean;
}

const NetworkBanner: React.FC<NetworkBannerProps> = ({ missionMapOfflineReady = false }) => {
  const online = useNetworkStatus();

  if (online && !missionMapOfflineReady) return null;

  if (!online) {
    return (
      <div className="w-full bg-yellow-600 text-black text-xs py-2 px-4 text-center z-50">
        {missionMapOfflineReady
          ? 'Offline. Mission map is available offline and location updates will be queued for sync.'
          : 'Offline. Location updates will be queued and synced when back online.'}
      </div>
    );
  }

  return (
    <div className="w-full bg-emerald-700 text-white text-xs py-2 px-4 text-center z-50">
      Map available offline for the active mission.
    </div>
  );
};

export default NetworkBanner;
