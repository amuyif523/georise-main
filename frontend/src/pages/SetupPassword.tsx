import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck, Lock, ArrowRight, CheckCircle2 } from 'lucide-react';
import api from '../lib/api';
import { useAuth } from '../context/AuthContext';

const getStrength = (password: string) => {
  if (password.length === 0) return 0;
  let score = 0;
  if (password.length >= 8) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;
  return score;
};

const SetupPassword = () => {
  const navigate = useNavigate();
  const { setAuth } = useAuth();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const strength = useMemo(() => getStrength(newPassword), [newPassword]);
  const passwordsMatch = confirmPassword.length > 0 && newPassword === confirmPassword;
  const canSubmit =
    newPassword.length >= 8 && confirmPassword.length >= 8 && newPassword === confirmPassword;

  const strengthTone =
    strength < 2
      ? 'from-rose-500 to-orange-400'
      : strength < 3
        ? 'from-amber-400 to-yellow-300'
        : 'from-emerald-400 to-cyan-300';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;

    if (!canSubmit) {
      setError('Please enter matching passwords with at least 8 characters.');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await api.post('/auth/complete-onboarding', { newPassword });
      setAuth(res.data.user, res.data.token, res.data.refreshToken);
      setSuccess('Password updated. Redirecting to your dashboard...');
      setTimeout(() => navigate('/redirect-after-login', { replace: true }), 500);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to complete onboarding.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#020617] text-slate-100 overflow-hidden relative">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(14,165,233,0.18),_transparent_35%),radial-gradient(circle_at_bottom,_rgba(16,185,129,0.16),_transparent_30%)]" />
      <div className="absolute inset-0 opacity-30 [background-image:linear-gradient(rgba(148,163,184,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.08)_1px,transparent_1px)] [background-size:32px_32px]" />

      <div className="relative z-10 min-h-screen flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-lg rounded-3xl border border-cyan-400/20 bg-slate-950/70 backdrop-blur-xl shadow-[0_25px_80px_rgba(2,6,23,0.75)]">
          <div className="p-8 md:p-10 space-y-8">
            <div className="space-y-4">
              <div className="inline-flex items-center gap-3 rounded-full border border-cyan-400/30 bg-cyan-400/10 px-4 py-2 text-cyan-200">
                <ShieldCheck className="h-5 w-5" />
                <span className="text-sm font-medium tracking-[0.18em] uppercase">
                  Welcome to GEORISE
                </span>
              </div>
              <div className="space-y-2">
                <h1 className="text-3xl md:text-4xl font-semibold tracking-tight text-white">
                  Secure your account
                </h1>
                <p className="text-slate-300 leading-relaxed">
                  Your one-time passcode got you in. Set a permanent password now to unlock your
                  workspace and continue to your dashboard.
                </p>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              <label className="block space-y-2">
                <span className="text-sm font-medium text-slate-200">New password</span>
                <div className="flex items-center gap-3 rounded-2xl border border-slate-800 bg-slate-900/80 px-4 py-3 focus-within:border-cyan-400/40">
                  <Lock className="h-4 w-4 text-slate-400" />
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Create a strong password"
                    className="w-full bg-transparent outline-none text-white placeholder:text-slate-500"
                    minLength={8}
                    required
                  />
                </div>
              </label>

              <div className="space-y-2">
                <div className="h-2 rounded-full bg-slate-900 overflow-hidden">
                  <div
                    className={`h-full bg-gradient-to-r ${strengthTone} transition-all duration-300`}
                    style={{ width: `${(strength / 4) * 100}%` }}
                  />
                </div>
                <p className="text-xs text-slate-400">
                  Use 8+ characters and mix uppercase, numbers, or symbols for a stronger password.
                </p>
              </div>

              <label className="block space-y-2">
                <span className="text-sm font-medium text-slate-200">Confirm password</span>
                <div className="flex items-center gap-3 rounded-2xl border border-slate-800 bg-slate-900/80 px-4 py-3 focus-within:border-emerald-400/40">
                  <CheckCircle2 className="h-4 w-4 text-slate-400" />
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter your password"
                    className="w-full bg-transparent outline-none text-white placeholder:text-slate-500"
                    minLength={8}
                    required
                  />
                </div>
              </label>

              {confirmPassword.length > 0 && (
                <p className={`text-sm ${passwordsMatch ? 'text-emerald-300' : 'text-rose-300'}`}>
                  {passwordsMatch ? 'Passwords match.' : 'Passwords must match.'}
                </p>
              )}

              {error && (
                <div className="rounded-2xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
                  {error}
                </div>
              )}

              {success && (
                <div className="rounded-2xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
                  {success}
                </div>
              )}

              <button
                type="submit"
                disabled={!canSubmit || loading}
                className="w-full inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-cyan-400 to-emerald-400 px-5 py-3 font-semibold text-slate-950 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? 'Securing account...' : 'Continue to Dashboard'}
                {!loading && <ArrowRight className="h-4 w-4" />}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SetupPassword;
