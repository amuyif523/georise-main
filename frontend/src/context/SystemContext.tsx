import React, { createContext, useContext, useEffect, useState } from 'react';
import api from '../lib/api';
import { getSocket } from '../lib/socket';

interface SystemContextType {
  crisisMode: boolean;
  toggleCrisisMode: (enabled: boolean) => Promise<void>;
  sendBroadcast: (message: string, targetGeoJSON?: string) => Promise<void>;
  lastBroadcast: BroadcastMessage | null;
}

interface BroadcastMessage {
  message: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  targetGeoJSON?: any;
  sentAt: string;
}

const SystemContext = createContext<SystemContextType | null>(null);

// eslint-disable-next-line react-refresh/only-export-components
export const useSystem = () => {
  const context = useContext(SystemContext);
  if (!context) throw new Error('useSystem must be used within SystemProvider');
  return context;
};

export const SystemProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [crisisMode, setCrisisMode] = useState(false);
  const [lastBroadcast, setLastBroadcast] = useState<BroadcastMessage | null>(null);

  useEffect(() => {
    // Fetch initial config
    const fetchConfig = async () => {
      try {
        const res = await api.get('/system/status');
        setCrisisMode(res.data.crisisMode);
      } catch (e) {
        console.warn('Failed to fetch system status', e);
      }
    };
    fetchConfig();

    // Socket listeners
    const socket = getSocket();
    if (socket) {
      socket.on('system:config', (data: { key: string; value: string }) => {
        if (data.key === 'CRISIS_MODE') {
          setCrisisMode(data.value === 'true');
        }
      });

      socket.on('system:broadcast', (data: BroadcastMessage) => {
        setLastBroadcast(data);
      });
    }

    return () => {
      if (socket) {
        socket.off('system:config');
        socket.off('system:broadcast');
      }
    };
  }, []);

  const toggleCrisisMode = async (enabled: boolean) => {
    await api.patch('/admin/config', { key: 'CRISIS_MODE', value: enabled ? 'true' : 'false' });
    setCrisisMode(enabled);
  };

  const sendBroadcast = async (message: string, targetGeoJSON?: string) => {
    await api.post('/admin/broadcast', { message, targetGeoJSON });
  };

  return (
    <SystemContext.Provider value={{ crisisMode, toggleCrisisMode, sendBroadcast, lastBroadcast }}>
      {children}
    </SystemContext.Provider>
  );
};
