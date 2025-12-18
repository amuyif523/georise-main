import React from 'react';
import { useNetworkStatus } from '../hooks/useNetworkStatus';

const NetworkBanner: React.FC = () => {
  const online = useNetworkStatus();
  if (online) return null;
  return (
    <div className="w-full bg-yellow-600 text-black text-xs py-2 px-4 text-center z-50">
      Offline. Location updates will be queued and synced when back online.
    </div>
  );
};

export default NetworkBanner;
