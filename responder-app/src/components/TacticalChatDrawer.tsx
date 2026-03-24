import React, { useEffect, useRef } from 'react';
import { ChevronDown, MessageSquareText, Send, ShieldAlert } from 'lucide-react';

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

type TacticalChatDrawerProps = {
  open: boolean;
  loading?: boolean;
  messages: ChatMessage[];
  currentUserId?: number;
  input: string;
  onInputChange: (value: string) => void;
  onToggle: () => void;
  onSend: () => void;
  onQuickSend: (message: string) => void;
};

const QUICK_ACTIONS = ['Traffic Heavy', 'Request Backup', 'Arrived at Scene'];

const TacticalChatDrawer: React.FC<TacticalChatDrawerProps> = ({
  open,
  loading = false,
  messages,
  currentUserId,
  input,
  onInputChange,
  onToggle,
  onSend,
  onQuickSend,
}) => {
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (open) {
      endRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, open]);

  return (
    <div className="fixed inset-x-0 bottom-0 z-[1200] mx-auto w-full max-w-md px-3 pb-3">
      <div className="overflow-hidden rounded-t-3xl border border-slate-700 bg-slate-950/95 shadow-2xl backdrop-blur">
        <button
          type="button"
          onClick={onToggle}
          className="flex w-full items-center justify-between border-b border-slate-800 px-4 py-3 text-left"
        >
          <div className="flex items-center gap-3">
            <div className="rounded-xl border border-cyan-500/30 bg-cyan-500/10 p-2 text-cyan-200">
              <MessageSquareText className="h-4 w-4" />
            </div>
            <div>
              <div className="text-sm font-semibold text-slate-100">Tactical Chat</div>
              <div className="text-[11px] text-slate-400">
                Live coordination with dispatch
              </div>
            </div>
          </div>
          <ChevronDown
            className={`h-5 w-5 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`}
          />
        </button>

        {open && (
          <div className="space-y-3 p-4">
            <div className="flex flex-wrap gap-2">
              {QUICK_ACTIONS.map((action) => (
                <button
                  key={action}
                  type="button"
                  className="rounded-full border border-slate-700 bg-slate-900 px-3 py-2 text-[11px] font-medium text-slate-200"
                  onClick={() => onQuickSend(action)}
                >
                  {action}
                </button>
              ))}
            </div>

            <div className="max-h-72 space-y-3 overflow-y-auto rounded-2xl border border-slate-800 bg-slate-900/70 p-3">
              {loading ? (
                <div className="text-xs text-slate-400">Loading channel history...</div>
              ) : messages.length > 0 ? (
                messages.map((msg) => {
                  const own = msg.senderId === currentUserId;
                  return (
                    <div
                      key={msg.id}
                      className={`flex ${own ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[85%] rounded-2xl px-3 py-2 ${
                          own
                            ? 'bg-cyan-500/15 text-cyan-50 border border-cyan-500/30'
                            : 'bg-slate-800 text-slate-100 border border-slate-700'
                        }`}
                      >
                        <div className="mb-1 text-[11px] text-slate-400">
                          {msg.sender?.fullName || 'Dispatch'} ·{' '}
                          {new Date(msg.createdAt).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </div>
                        <div className="text-sm leading-relaxed">{msg.message}</div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="flex items-center gap-2 rounded-xl border border-dashed border-slate-700 px-3 py-4 text-xs text-slate-400">
                  <ShieldAlert className="h-4 w-4 text-amber-300" />
                  No transmissions yet. Use the quick actions to update dispatch fast.
                </div>
              )}
              <div ref={endRef} />
            </div>

            <div className="flex items-end gap-2">
              <textarea
                value={input}
                onChange={(e) => onInputChange(e.target.value)}
                rows={2}
                placeholder="Send tactical update..."
                className="textarea textarea-bordered min-h-[72px] flex-1 border-slate-700 bg-slate-900 text-sm text-slate-100 placeholder:text-slate-500"
              />
              <button type="button" className="btn btn-info h-[72px]" onClick={onSend} disabled={!input.trim()}>
                <Send className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TacticalChatDrawer;
