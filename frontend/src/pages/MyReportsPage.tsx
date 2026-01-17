/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useEffect, useState } from 'react';
import {
  MapPin,
  Shield,
  Sparkles,
  Clock,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import api from '../lib/api';
import { getSocket } from '../lib/socket';
import AppLayout from '../layouts/AppLayout';
import { motion, AnimatePresence } from 'framer-motion';
import { formatDistanceToNow } from 'date-fns';

type ActivityLog = {
  id: string;
  type: string;
  message: string;
  createdAt: string;
};

type Incident = {
  id: number;
  title: string;
  description: string;
  category: string | null;
  severityScore: number | null;
  status: string;
  latitude: number | null;
  longitude: number | null;
  createdAt: string;
  timeline?: ActivityLog[];
  aiOutput?: {
    summary?: string | null;
  } | null;
};

const MyReportsPage: React.FC = () => {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  useEffect(() => {
    const fetch = async () => {
      try {
        const res = await api.get('/incidents/my');
        setIncidents(res.data.incidents || []);
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    };
    fetch();

    const socket = getSocket();
    if (socket) {
      socket.on('incident:updated', (inc: Incident) => {
        setIncidents(prev => prev.map(p => p.id === inc.id ? { ...p, ...inc } : p));
      });
      return () => { socket.off('incident:updated'); };
    }
  }, []);

  const toggleExpand = async (id: number) => {
    if (expandedId === id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(id);
    // Fetch timeline if needed
    try {
      const res = await api.get(`/incidents/${id}/timeline`);
      setIncidents(prev => prev.map(i => i.id === id ? { ...i, timeline: res.data.logs || [] } : i));
    } catch (e) { console.error(e); }
  };

  const getStatusStep = (status: string) => {
    // const flow = ['RECEIVED', 'UNDER_REVIEW', 'DISPATCHED', 'RESOLVED']; (Removed unused)
    const map: Record<string, number> = {
      'RECEIVED': 0, 'PENDING_REVIEW': 0,
      'ASSIGNED': 1, 'UNDER_REVIEW': 1,
      'DISPATCHED': 2, 'RESPONDING': 2, 'ON_SCENE': 2,
      'RESOLVED': 3, 'CLOSED': 3
    };
    return map[status] ?? 0;
  };

  return (
    <AppLayout>
      <div className="flex flex-col md:flex-row justify-between items-end mb-8 bg-base-100/50 backdrop-blur p-6 rounded-2xl border border-base-content/5">
        <div>
          <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary to-secondary">
            Mission Log
          </h1>
          <p className="text-sm text-base-content/60 mt-1 font-mono tracking-wide">
            OPERATIONAL HISTORY • {incidents.length} RECORDS
          </p>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center p-12"><span className="loading loading-bars text-primary"></span></div>
      ) : incidents.length === 0 ? (
        <div className="text-center p-12 border-2 border-dashed border-base-content/10 rounded-xl opacity-50">
          <Shield className="w-12 h-12 mx-auto mb-4" />
          <p>No missions on record.</p>
        </div>
      ) : (
        <div className="space-y-4">
          <AnimatePresence>
            {incidents.map((incident, idx) => (
              <motion.div
                key={incident.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.1 }}
                className={`card bg-base-100 shadow-lg border-l-4 overflow-hidden relative group transition-all duration-300 ${expandedId === incident.id ? 'ring-2 ring-base-content/5' : ''
                  }`}
                style={{
                  borderLeftColor: (incident.severityScore || 0) >= 4 ? '#ef4444' :
                    (incident.severityScore || 0) >= 3 ? '#eab308' : '#3b82f6'
                }}
              >
                <div className="card-body p-0">
                  {/* Main Row */}
                  <div
                    className="p-6 cursor-pointer hover:bg-base-200/50 transition-colors flex flex-col md:flex-row gap-6 items-start md:items-center"
                    onClick={() => toggleExpand(incident.id)}
                  >
                    {/* Icon & Sev */}
                    <div className="flex flex-col items-center gap-2 min-w-[60px]">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-white shadow-md ${(incident.severityScore || 0) >= 4 ? 'bg-error' :
                        (incident.severityScore || 0) >= 3 ? 'bg-warning' : 'bg-info'
                        }`}>
                        {incident.severityScore ?? '?'}
                      </div>
                      <span className="text-[10px] font-mono font-bold uppercase opacity-50">SEV LEVEL</span>
                    </div>

                    {/* Content */}
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-1">
                        <h3 className="text-lg font-bold text-base-content">{incident.title}</h3>
                        <span className="badge badge-ghost badge-sm font-mono">{incident.status}</span>
                      </div>
                      <div className="flex flex-wrap items-center gap-4 text-xs text-base-content/60">
                        <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {formatDistanceToNow(new Date(incident.createdAt))} ago</span>
                        <span className="flex items-center gap-1"><MapPin className="w-3 h-3" /> Lat: {incident.latitude?.toFixed(3)}</span>
                        <span className="flex items-center gap-1"><Sparkles className="w-3 h-3 text-secondary" /> AI Cat: {incident.category}</span>
                      </div>
                    </div>

                    {/* Action */}
                    <div className="text-secondary">
                      {expandedId === incident.id ? <ChevronUp /> : <ChevronDown />}
                    </div>
                  </div>

                  {/* Expanded Details */}
                  <AnimatePresence>
                    {expandedId === incident.id && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="bg-base-200/50 border-t border-base-content/5"
                      >
                        <div className="p-6 grid md:grid-cols-2 gap-8">
                          <div>
                            <h4 className="text-xs font-bold uppercase text-base-content/40 mb-3 tracking-widest">Operation Status</h4>
                            {/* Stepper */}
                            <ul className="steps w-full text-xs">
                              <li className={`step ${getStatusStep(incident.status) >= 0 ? 'step-primary' : ''}`}>Reported</li>
                              <li className={`step ${getStatusStep(incident.status) >= 1 ? 'step-primary' : ''}`}>Reviewed</li>
                              <li className={`step ${getStatusStep(incident.status) >= 2 ? 'step-primary' : ''}`}>Dispatched</li>
                              <li className={`step ${getStatusStep(incident.status) >= 3 ? 'step-primary' : ''}`}>Resolved</li>
                            </ul>

                            <div className="mt-6 p-4 bg-base-100 rounded-lg border border-base-content/5">
                              <p className="text-sm leading-relaxed">{incident.description}</p>
                              {incident.aiOutput?.summary && (
                                <div className="mt-3 pt-3 border-t border-base-content/10 flex gap-2">
                                  <Sparkles className="w-4 h-4 text-secondary shrink-0 mt-1" />
                                  <p className="text-xs text-base-content/70 italic">"{incident.aiOutput.summary}"</p>
                                </div>
                              )}
                            </div>
                          </div>

                          <div>
                            <h4 className="text-xs font-bold uppercase text-base-content/40 mb-3 tracking-widest">Comm Log</h4>
                            <div className="h-48 overflow-y-auto custom-scrollbar space-y-3 pr-2">
                              {incident.timeline?.map((log, i) => (
                                <div key={i} className="flex gap-3 text-sm group">
                                  <div className="flex flex-col items-center">
                                    <div className="w-2 h-2 rounded-full bg-primary/50 mt-1.5 peer-hover:bg-primary transition-colors"></div>
                                    <div className="w-px h-full bg-base-content/5 my-1"></div>
                                  </div>
                                  <div className="pb-2">
                                    <p className="text-base-content/80">{log.message}</p>
                                    <p className="text-[10px] text-base-content/40 font-mono">{formatDistanceToNow(new Date(log.createdAt))} ago</p>
                                  </div>
                                </div>
                              ))}
                              {!incident.timeline?.length && (
                                <div className="text-center text-xs opacity-50 py-8">No transmission data.</div>
                              )}
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </AppLayout>
  );
};

export default MyReportsPage;
