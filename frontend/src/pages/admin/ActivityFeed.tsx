/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useEffect, useState } from 'react';
import AppLayout from '../../layouts/AppLayout';
import { getSocket } from '../../lib/socket';
import api from '../../lib/api';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Activity,
  Radio,
  AlertTriangle,
  CheckCircle,
  MapPin,
  MessageSquare,
  Clock,
} from 'lucide-react';

type ActivityItem = {
  id: string;
  type: string;
  incidentId: number;
  message?: string;
  incident?: {
    title: string;
    category: string | null;
    status: string;
    severityScore: number | null;
  };
  user?: {
    fullName: string;
    role: string;
  };
  createdAt: string;
};

const ActivityFeed: React.FC = () => {
  const [events, setEvents] = useState<ActivityItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch initial history
  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const { data } = await api.get('/incidents/activity/feed');
        setEvents(data);
      } catch (err) {
        console.error('Failed to fetch activity history', err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchHistory();
  }, []);

  // Socket listeners for live updates
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const pushEvent = (type: string, incident: any) => {
      setEvents((prev) => [
        {
          id: `${type}-${incident.id}-${Date.now()}`,
          type,
          incidentId: incident.id,
          incident: {
            title: incident.title,
            category: incident.category,
            status: incident.status,
            severityScore: incident.severityScore,
          },
          createdAt: new Date().toISOString(),
        },
        ...prev.slice(0, 50),
      ]);
    };

    const createdHandler = (inc: any) => pushEvent('CREATED', inc);
    const updatedHandler = (inc: any) => pushEvent('UPDATED', inc);

    socket.on('incident:created', createdHandler);
    socket.on('incident:updated', updatedHandler);

    return () => {
      socket?.off('incident:created', createdHandler);
      socket?.off('incident:updated', updatedHandler);
    };
  }, []);

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'CREATED':
        return 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10';
      case 'UPDATED':
        return 'text-blue-400 border-blue-500/30 bg-blue-500/10';
      case 'STATUS_CHANGE':
        return 'text-amber-400 border-amber-500/30 bg-amber-500/10';
      case 'DISPATCH':
        return 'text-red-400 border-red-500/30 bg-red-500/10';
      case 'ASSIGNMENT':
        return 'text-purple-400 border-purple-500/30 bg-purple-500/10';
      case 'RESOLVED':
        return 'text-green-400 border-green-500/30 bg-green-500/10';
      default:
        return 'text-slate-400 border-slate-700 bg-slate-800/50';
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'CREATED':
        return <Radio className="w-4 h-4" />;
      case 'UPDATED':
        return <Activity className="w-4 h-4" />;
      case 'STATUS_CHANGE':
        return <Clock className="w-4 h-4" />;
      case 'DISPATCH':
        return <MapPin className="w-4 h-4" />;
      case 'ASSIGNMENT':
        return <AlertTriangle className="w-4 h-4" />;
      case 'RESOLVED':
        return <CheckCircle className="w-4 h-4" />;
      case 'COMMENT':
        return <MessageSquare className="w-4 h-4" />;
      default:
        return <Activity className="w-4 h-4" />;
    }
  };

  return (
    <AppLayout>
      <div className="min-h-screen bg-[#050B14] text-slate-200 font-sans p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div className="w-2 h-2 bg-cyan-500 rounded-full animate-pulse" />
              <p className="text-xs font-mono text-cyan-400 uppercase tracking-widest">
                System Monitor
              </p>
            </div>
            <h1 className="text-3xl font-bold text-white tracking-tight glitch-text">
              Network Activity Feed
            </h1>
          </div>
          <div className="px-4 py-2 bg-slate-900/50 border border-slate-700 rounded-lg backdrop-blur-sm">
            <span className="text-xs text-slate-400 uppercase tracking-wider mr-2">Status</span>
            <span className="text-sm font-bold text-emerald-400">ONLINE</span>
          </div>
        </div>

        {/* Feed Container */}
        <div className="max-w-4xl mx-auto bg-[#0D121D]/80 border border-slate-800 rounded-xl overflow-hidden backdrop-blur-md shadow-2xl">
          {/* Feed Header */}
          <div className="px-6 py-4 border-b border-slate-800 bg-slate-900/50 flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
              <Activity className="w-4 h-4 text-cyan-500" />
              Live Stream
            </h2>
            <div className="text-xs font-mono text-slate-500">
              Auto-refreshing via Secure Socket Layer
            </div>
          </div>

          {/* List */}
          <div className="p-2 space-y-1 max-h-[80vh] overflow-y-auto custom-scrollbar">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-20 gap-4 text-slate-500">
                <div className="w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
                <p className="text-sm font-mono animate-pulse">ESTABLISHING UPLINK...</p>
              </div>
            ) : (
              <AnimatePresence initial={false}>
                {events.length === 0 ? (
                  <div className="text-center py-20 text-slate-600 font-mono text-sm">
                    NO ACTIVITY DETECTED
                  </div>
                ) : (
                  events.map((e) => (
                    <motion.div
                      key={e.id}
                      initial={{ opacity: 0, x: -20, height: 0 }}
                      animate={{ opacity: 1, x: 0, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="group relative"
                    >
                      <div
                        className={`
                        relative flex items-start gap-4 p-4 mx-2 rounded-lg border transition-all duration-300
                        hover:bg-slate-800/50 hover:border-slate-600 hover:shadow-lg
                        ${getTypeColor(e.type).split(' ')[2]} 
                        border-slate-800/50 bg-[#0F1623]
                      `}
                      >
                        {/* Time Column */}
                        <div className="flex flex-col items-center gap-1 min-w-[80px]">
                          <span className="text-xs font-mono text-slate-400 group-hover:text-cyan-400 transition-colors">
                            {new Date(e.createdAt).toLocaleTimeString([], { hour12: false })}
                          </span>
                          <div
                            className={`p-2 rounded-full border ${getTypeColor(e.type).split(' ')[1]} ${getTypeColor(e.type).split(' ')[0]} bg-slate-900`}
                          >
                            {getTypeIcon(e.type)}
                          </div>
                          <div className="h-full w-px bg-slate-800 group-last:hidden mt-2" />
                        </div>

                        {/* Content Column */}
                        <div className="flex-1 min-w-0 pt-1">
                          <div className="flex items-center justify-between mb-1">
                            <h3
                              className={`text-sm font-bold uppercase tracking-wide ${getTypeColor(e.type).split(' ')[0]}`}
                            >
                              {e.type.replace('_', ' ')}
                            </h3>
                            {e.incident?.status && (
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-900 border border-slate-700 text-slate-400">
                                {e.incident.status}
                              </span>
                            )}
                          </div>

                          <p className="text-slate-300 text-sm leading-relaxed mb-1">
                            {e.message || (
                              <>
                                Activity on Incident{' '}
                                <span className="font-mono text-cyan-400">#{e.incidentId}</span>
                                {e.incident?.title && ` - ${e.incident.title}`}
                              </>
                            )}
                          </p>

                          <div className="flex items-center gap-4 text-xs text-slate-500 font-mono mt-2">
                            {e.incident?.category && (
                              <span className="flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-slate-600" />
                                {e.incident.category}
                              </span>
                            )}
                            {e.user && (
                              <span className="flex items-center gap-1 text-slate-400">
                                BY: {e.user.fullName}{' '}
                                <span className="opacity-50">[{e.user.role}]</span>
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Hover Effect */}
                        <div className="absolute inset-0 border-2 border-transparent group-hover:border-cyan-500/20 rounded-lg pointer-events-none transition-all duration-500" />
                      </div>
                    </motion.div>
                  ))
                )}
              </AnimatePresence>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-3 border-t border-slate-800 bg-slate-900/80 text-[10px] text-slate-500 font-mono text-center flex justify-between">
            <span>SECURE CONNECTION ESTABLISHED</span>
            <span>LAST SYNC: {new Date().toLocaleTimeString()}</span>
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

export default ActivityFeed;
