import React from 'react';
import { Bell, BellOff, Loader2 } from 'lucide-react';
import { useNotifications } from '../../context/NotificationContext';

const NotificationToggle: React.FC = () => {
  const { permission, isSubscribed, loading, requestPermission, subscribe, unsubscribe } =
    useNotifications();

  const handleToggle = async () => {
    if (loading) return;

    if (isSubscribed) {
      await unsubscribe();
    } else {
      if (permission === 'default') {
        const result = await requestPermission();
        if (result === 'granted') {
          await subscribe();
        }
      } else if (permission === 'granted') {
        await subscribe();
      } else {
        alert('Notifications are blocked. Please enable them in your browser settings.');
      }
    }
  };

  if (!('Notification' in window)) return null;

  return (
    <button
      onClick={handleToggle}
      className={`btn btn-circle btn-ghost btn-sm ${isSubscribed ? 'text-cyan-400' : 'text-slate-500'}`}
      title={isSubscribed ? 'Disable Notifications' : 'Enable Notifications'}
      disabled={loading}
    >
      {loading ? (
        <Loader2 className="animate-spin" size={18} />
      ) : isSubscribed ? (
        <Bell size={18} />
      ) : (
        <BellOff size={18} />
      )}
    </button>
  );
};

export default NotificationToggle;
