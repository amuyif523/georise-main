import React, { useEffect, useRef, useState } from 'react';
import { LoaderCircle, MessageSquareText, Send } from 'lucide-react';
import api from '../lib/api';
import { getSocket } from '../lib/socket';
import { useAuth } from '../context/AuthContext';
import type { IncidentListItem } from '../types/incidents';

type ChatMessage = {
  id: number;
  incidentId: number;
  senderId: number;
  message: string;
  createdAt: string;
  sender?: {
    id: number;
    fullName?: string | null;
    role?: string | null;
  } | null;
};

type AgencyChatProps = {
  incident: IncidentListItem | null;
};

const AgencyChat: React.FC<AgencyChatProps> = ({ incident }) => {
  const { user } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!incident) {
      setMessages([]);
      setInput('');
      return;
    }

    let cancelled = false;

    const loadHistory = async () => {
      setLoading(true);
      try {
        const res = await api.get(`/incidents/${incident.id}/chat`);
        if (!cancelled) {
          setMessages(res.data?.messages || []);
        }
      } catch (err) {
        console.error('Failed to load agency chat history', err);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void loadHistory();

    const socket = getSocket();
    const onIncomingMessage = (msg: ChatMessage) => {
      if (msg.incidentId !== incident.id) return;
      setMessages((prev) => {
        if (prev.some((existing) => existing.id === msg.id)) {
          return prev;
        }
        return [...prev, msg];
      });
    };

    if (socket) {
      socket.emit('join_incident', incident.id);
      socket.emit('join:incident', incident.id);
      socket.on('incident:message', onIncomingMessage);
      socket.on('incident:chat', onIncomingMessage);
    }

    return () => {
      cancelled = true;
      if (socket) {
        socket.emit('leave_incident', incident.id);
        socket.off('incident:message', onIncomingMessage);
        socket.off('incident:chat', onIncomingMessage);
      }
    };
  }, [incident?.id]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!incident || !input.trim()) return;

    try {
      await api.post(`/incidents/${incident.id}/chat`, { message: input.trim() });
      setInput('');
    } catch (err) {
      console.error('Failed to send agency chat message', err);
    }
  };

  if (!incident) {
    return (
      <div className="rounded-xl border border-dashed border-slate-700 bg-slate-900/50 p-6 text-sm text-slate-400">
        Select an incident to view responder coordination.
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/60">
      <div className="flex items-center gap-2 border-b border-slate-800 px-4 py-3">
        <div className="rounded-lg border border-cyan-500/20 bg-cyan-500/10 p-2 text-cyan-300">
          <MessageSquareText className="h-4 w-4" />
        </div>
        <div>
          <div className="text-sm font-semibold text-slate-100">Tactical Command</div>
          <div className="text-xs text-slate-400">{incident.title}</div>
        </div>
      </div>

      <div className="max-h-[26rem] min-h-[18rem] space-y-3 overflow-y-auto px-4 py-4">
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-slate-400">
            <LoaderCircle className="h-4 w-4 animate-spin" />
            Loading conversation...
          </div>
        ) : messages.length > 0 ? (
          messages.map((msg) => {
            const own =
              msg.senderId === user?.id ||
              msg.sender?.role === 'AGENCY_MANAGER' ||
              msg.sender?.role === 'AGENCY_STAFF';

            return (
              <div key={msg.id} className={`flex ${own ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[85%] rounded-2xl border px-3 py-2 ${
                    own
                      ? 'border-cyan-500/30 bg-cyan-500/15 text-cyan-50'
                      : 'border-slate-700 bg-slate-800 text-slate-100'
                  }`}
                >
                  <div className="mb-1 flex items-center justify-between gap-3 text-[11px] text-slate-400">
                    <span className="font-semibold uppercase tracking-[0.14em]">
                      {own ? 'Agency' : msg.sender?.fullName || msg.sender?.role || 'Responder'}
                    </span>
                    <span>
                      {new Date(msg.createdAt).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                  <div className="text-sm leading-relaxed">{msg.message}</div>
                </div>
              </div>
            );
          })
        ) : (
          <div className="rounded-xl border border-dashed border-slate-700 px-4 py-6 text-sm text-slate-400">
            No tactical messages yet for this incident.
          </div>
        )}
        <div ref={endRef} />
      </div>

      <form onSubmit={handleSend} className="flex items-end gap-2 border-t border-slate-800 p-4">
        <textarea
          rows={3}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Send tactical update to the responder..."
          className="textarea textarea-bordered min-h-[88px] flex-1 border-slate-700 bg-slate-950 text-sm text-slate-100 placeholder:text-slate-500"
        />
        <button type="submit" className="btn btn-primary h-[88px]" disabled={!input.trim()}>
          <Send className="h-4 w-4" />
        </button>
      </form>
    </div>
  );
};

export default AgencyChat;
