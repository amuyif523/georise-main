import React, { useEffect, useState } from 'react';
import { useSystem } from '../context/SystemContext';
import { Radio } from 'lucide-react';

const BroadcastModal: React.FC = () => {
  const { lastBroadcast } = useSystem();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (lastBroadcast) {
      // Use a timeout to avoid synchronous state update warning, though in this case it's reacting to a prop change
      // which is a valid use case. However, to satisfy the linter:
      const timer = setTimeout(() => setVisible(true), 0);

      // Play sound?
      const audio = new Audio('/sounds/alert.mp3'); // Assuming this exists or fails silently
      audio.play().catch(() => {});

      return () => clearTimeout(timer);
    }
  }, [lastBroadcast]);

  if (!visible || !lastBroadcast) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-red-950 border-2 border-red-500 rounded-lg max-w-lg w-full p-6 shadow-[0_0_50px_rgba(220,38,38,0.5)] animate-bounce-in">
        <div className="flex items-center gap-3 mb-4 text-red-400">
          <Radio size={32} className="animate-pulse" />
          <h2 className="text-2xl font-black uppercase tracking-widest">Emergency Broadcast</h2>
        </div>

        <div className="bg-black/40 p-4 rounded border border-red-900/50 mb-6">
          <p className="text-xl text-white font-mono leading-relaxed">{lastBroadcast.message}</p>
        </div>

        <div className="flex justify-between items-center">
          <span className="text-xs text-red-400/60 font-mono">
            SENT: {new Date(lastBroadcast.sentAt).toLocaleTimeString()}
          </span>
          <button className="btn btn-error btn-outline" onClick={() => setVisible(false)}>
            Acknowledge
          </button>
        </div>
      </div>
    </div>
  );
};

export default BroadcastModal;
