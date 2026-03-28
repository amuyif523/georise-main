import React, { useEffect, useRef } from 'react';
import { ChevronDown, Clock3, LoaderCircle, MessageCircle, MessageSquareText, Send, ShieldAlert } from 'lucide-react';

type ChatMessage = {
  id: number;
  incidentId: number;
  senderId: number;
  message: string;
  createdAt: string;
  syncState?: 'PENDING' | 'SYNCING';
  sender?: {
    id: number;
    fullName?: string | null;
    role?: string | null;
  } | null;
};

type TacticalChatDrawerProps = {
  open: boolean;
  incidentId?: number | null;
  loading?: boolean;
  messages: ChatMessage[];
  currentUserId?: number;
  input: string;
  onInputChange: (value: string) => void;
  onToggle: () => void;
  onSend: (message: string) => Promise<void>;
  onQuickSend: (message: string) => Promise<void>;
  onQueueFailedMessage: (message: string) => Promise<void>;
  onHydrateHistory?: (incidentId: number) => Promise<void> | void;
  compactMode?: boolean;
};

const QUICK_ACTIONS = ['Traffic Heavy', 'Request Backup', 'Arrived at Scene'];

const TacticalChatDrawer: React.FC<TacticalChatDrawerProps> = ({
  open,
  incidentId,
  loading = false,
  messages,
  currentUserId,
  input,
  onInputChange,
  onToggle,
  onSend,
  onQuickSend,
  onQueueFailedMessage,
  onHydrateHistory,
  compactMode = false,
}) => {
  const endRef = useRef<HTMLDivElement | null>(null);
  const lastHydratedKeyRef = useRef<string | null>(null);
  const wasOpenRef = useRef(false);

  const isConnectivityError = (err: any) =>
    !err?.response || err?.code === 'ERR_NETWORK' || /network/i.test(err?.message || '');

  const dispatchMessage = async (text: string, useQuickPath = false) => {
    const payload = text.trim();
    if (!payload) return;

    try {
      if (useQuickPath) {
        await onQuickSend(payload);
      } else {
        await onSend(payload);
      }
    } catch (err: any) {
      if (isConnectivityError(err)) {
        await onQueueFailedMessage(payload);
      } else {
        console.error('Failed to send tactical message', err);
      }
    }
  };

  useEffect(() => {
    const justOpened = open && !wasOpenRef.current;
    const hydrateKey = incidentId ? `${incidentId}:${open ? 'open' : 'closed'}` : null;

    if (open && incidentId && onHydrateHistory && (justOpened || lastHydratedKeyRef.current !== hydrateKey)) {
      lastHydratedKeyRef.current = hydrateKey;
      void onHydrateHistory(incidentId);
    }

    if (!open) {
      lastHydratedKeyRef.current = null;
    }

    wasOpenRef.current = open;
  }, [incidentId, onHydrateHistory, open]);

  useEffect(() => {
    if (open) {
      endRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages.length, open]);

  const drawerContent = (
      <div className="overflow-hidden rounded-t-3xl border border-slate-700/50 bg-slate-900/80 shadow-2xl backdrop-blur-md">
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
                  onClick={() => {
                    void dispatchMessage(action, true);
                  }}
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
                  const senderLabel = own
                    ? 'You'
                    : msg.sender?.fullName || msg.sender?.role || 'Dispatch';
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
                        <div className="mb-1 flex items-center justify-between gap-3 text-[11px] text-slate-400">
                          <span className="font-semibold uppercase tracking-[0.14em]">
                            {senderLabel}
                          </span>
                          <span>
                          {new Date(msg.createdAt).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                          </span>
                        </div>
                        <div className="text-sm leading-relaxed">{msg.message}</div>
                        {msg.syncState && (
                          <div className="mt-2 flex items-center gap-1 text-[11px] text-slate-300">
                            {msg.syncState === 'PENDING' ? (
                              <>
                                <Clock3 className="h-3 w-3 text-amber-300" />
                                <span>Pending</span>
                              </>
                            ) : (
                              <>
                                <LoaderCircle className="h-3 w-3 animate-spin text-cyan-300" />
                                <span>Syncing</span>
                              </>
                            )}
                          </div>
                        )}
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
              <button
                type="button"
                className="btn btn-info h-[72px]"
                onClick={() => {
                  void dispatchMessage(input);
                }}
                disabled={!input.trim()}
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>
  );

  if (compactMode) {
    return (
      <div className="fixed bottom-4 right-4 z-[1300]">
        {open ? (
          <div className="mb-3 w-[min(22rem,calc(100vw-2rem))] max-h-[45vh] overflow-hidden rounded-3xl border border-slate-700/50 bg-slate-900/80 shadow-2xl backdrop-blur-md">
            {drawerContent}
          </div>
        ) : null}
        <button
          type="button"
          onClick={onToggle}
          className="flex h-14 w-14 items-center justify-center rounded-full border border-slate-700/50 bg-slate-900/80 text-cyan-200 shadow-2xl backdrop-blur-md"
          aria-label="Open tactical chat"
        >
          <MessageCircle className="h-6 w-6" />
        </button>
      </div>
    );
  }

  return (
    <div className="fixed inset-x-0 bottom-0 z-[1200] mx-auto w-full max-w-md px-3 pb-3">
      {drawerContent}
    </div>
  );
};

export default TacticalChatDrawer;
