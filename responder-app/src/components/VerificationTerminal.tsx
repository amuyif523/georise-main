import React from 'react';
import { AlertTriangle, CheckCircle2, Clock3, RefreshCw, ShieldAlert } from 'lucide-react';

type VerificationRequest = {
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  reviewNote?: string | null;
};

type AuthUser = {
  fullName: string;
  isVerified?: boolean;
  verificationRequest?: VerificationRequest | null;
};

interface VerificationTerminalProps {
  user: AuthUser;
  loading?: boolean;
  onRefresh: () => Promise<void>;
  onLogout: () => void;
}

const VerificationTerminal: React.FC<VerificationTerminalProps> = ({
  user,
  loading = false,
  onRefresh,
  onLogout,
}) => {
  const status = user.isVerified
    ? 'VERIFIED'
    : user.verificationRequest?.status || 'PENDING';

  const badgeTone =
    status === 'VERIFIED'
      ? 'border-emerald-400/30 bg-emerald-500/10 text-emerald-200'
      : status === 'REJECTED'
        ? 'border-rose-400/30 bg-rose-500/10 text-rose-200'
        : 'border-amber-400/30 bg-amber-500/10 text-amber-200';

  const Icon =
    status === 'VERIFIED' ? CheckCircle2 : status === 'REJECTED' ? AlertTriangle : Clock3;

  const headline =
    status === 'VERIFIED'
      ? 'Identity verified'
      : status === 'REJECTED'
        ? 'Verification requires action'
        : 'Verification pending review';

  const description =
    status === 'VERIFIED'
      ? 'You are cleared to go on duty.'
      : status === 'REJECTED'
        ? 'Your identity check was rejected. Contact command or resubmit through the main platform.'
        : 'Your identity is still under review. You cannot go on duty until approval is complete.';

  return (
    <div className="min-h-screen bg-[#020617] text-slate-100 relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(59,130,246,0.16),_transparent_35%),radial-gradient(circle_at_bottom,_rgba(249,115,22,0.12),_transparent_30%)]" />
      <div className="absolute inset-0 opacity-25 [background-image:linear-gradient(rgba(148,163,184,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.08)_1px,transparent_1px)] [background-size:24px_24px]" />

      <div className="relative z-10 min-h-screen flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-md rounded-3xl border border-slate-700 bg-slate-950/85 backdrop-blur-xl shadow-[0_25px_80px_rgba(2,6,23,0.75)]">
          <div className="p-6 space-y-6">
            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/25 bg-cyan-500/10 px-4 py-2 text-cyan-200">
                <ShieldAlert className="h-4 w-4" />
                <span className="text-xs font-medium tracking-[0.18em] uppercase">
                  Verification Terminal
                </span>
              </div>

              <div>
                <h1 className="text-2xl font-semibold text-white">{headline}</h1>
                <p className="mt-2 text-sm text-slate-300">
                  {user.fullName}, {description}
                </p>
              </div>
            </div>

            <div className={`rounded-2xl border px-4 py-4 ${badgeTone}`}>
              <div className="flex items-center gap-3">
                <Icon className="h-5 w-5" />
                <div>
                  <div className="text-xs uppercase tracking-[0.18em] opacity-80">Status</div>
                  <div className="text-lg font-semibold">{status}</div>
                </div>
              </div>
            </div>

            {user.verificationRequest?.reviewNote && (
              <div className="rounded-2xl border border-slate-700 bg-slate-900/70 px-4 py-4">
                <div className="text-xs uppercase tracking-[0.18em] text-slate-400">Review note</div>
                <p className="mt-2 text-sm text-slate-200">{user.verificationRequest.reviewNote}</p>
              </div>
            )}

            <div className="space-y-3">
              <button
                type="button"
                onClick={() => void onRefresh()}
                disabled={loading}
                className="w-full inline-flex items-center justify-center gap-2 rounded-2xl bg-cyan-400 px-5 py-3 font-semibold text-slate-950 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                {loading ? 'Refreshing status...' : 'Refresh status'}
              </button>

              <button
                type="button"
                onClick={onLogout}
                className="w-full rounded-2xl border border-slate-700 px-5 py-3 text-sm font-medium text-slate-300 transition hover:border-slate-500 hover:text-white"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VerificationTerminal;
