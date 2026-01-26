/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useEffect } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../lib/api';
import { useTranslation } from 'react-i18next';
import LanguageSwitcher from '../components/LanguageSwitcher';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  Smartphone,
  ArrowRight,
  ShieldCheck,
  Activity,
} from 'lucide-react';

const LoginPage: React.FC = () => {
  const { t } = useTranslation();
  const { login, setAuth } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [mode, setMode] = useState<'EMAIL' | 'OTP'>('EMAIL');
  const [email, setEmail] = useState('citizen@georise.com');
  const [password, setPassword] = useState('password123');
  const [showPassword, setShowPassword] = useState(false);
  const [phone, setPhone] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [otpSent, setOtpSent] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [rateLimitedUntil, setRateLimitedUntil] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (searchParams.get('registered') === 'true') {
      setSuccess(t('auth.create_account') + ' ' + t('common.success'));
    }
  }, [searchParams, t]);

  useEffect(() => {
    if (!rateLimitedUntil) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [rateLimitedUntil]);

  const rateLimitRemainingMs =
    rateLimitedUntil && rateLimitedUntil > now ? rateLimitedUntil - now : 0;
  const isRateLimited = rateLimitRemainingMs > 0;
  const rateLimitMessage =
    rateLimitRemainingMs > 0
      ? `Too many requests. Please wait ${Math.ceil(rateLimitRemainingMs / 1000)}s and try again.`
      : null;

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading || isRateLimited) return;
    setError(null);
    setSuccess(null);
    setLoading(true);
    try {
      await login(email, password);
      navigate('/redirect-after-login');
    } catch (err: any) {
      handleError(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSendOtp = async () => {
    if (loading || isRateLimited) return;
    if (!phone) {
      setError('Phone number is required');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await api.post('/auth/otp/request', { phone });
      setOtpSent(true);
      setSuccess('OTP sent to your phone.');
    } catch (err: any) {
      handleError(err);
    } finally {
      setLoading(false);
    }
  };

  const handleOtpLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading || isRateLimited) return;
    setError(null);
    setLoading(true);
    try {
      const res = await api.post('/auth/otp/verify', { phone, code: otpCode });
      setAuth(res.data.user, res.data.token, res.data.refreshToken);
      navigate('/redirect-after-login');
    } catch (err: any) {
      handleError(err);
    } finally {
      setLoading(false);
    }
  };

  const handleError = (err: any) => {
    const is429 = err?.response?.status === 429;
    const retryMs: number | undefined = err?.retryAfterMs;
    if (is429) {
      const until = Date.now() + (retryMs ?? 60_000);
      setRateLimitedUntil(until);
      setError(
        retryMs
          ? `Too many requests. Try again in ${Math.ceil((retryMs ?? 0) / 1000)}s.`
          : 'Too many requests. Please wait and retry.',
      );
    } else {
      setError(err?.response?.data?.message || t('common.error'));
    }
  };

  return (
    <div className="min-h-screen flex bg-base-200 font-sans">
      {/* Absolute Language Switcher */}
      <div className="absolute top-6 right-6 z-50">
        <LanguageSwitcher />
      </div>

      {/* Left Side: Hero Visual */}
      <div className="hidden lg:flex lg:w-1/2 relative bg-neutral overflow-hidden items-center justify-center">
        <div className="absolute inset-0 bg-gradient-to-t from-neutral to-transparent z-10 opacity-90"></div>
        <img
          src="/assets/login_hero.png"
          alt="Cyber Command"
          className="absolute inset-0 w-full h-full object-cover opacity-60"
        />
        <div className="relative z-20 max-w-lg px-12 text-center items-center flex flex-col">
          <div className="mb-6 p-4 bg-primary/20 backdrop-blur-sm rounded-full inline-block border border-primary/40 shadow-[0_0_30px_rgba(37,99,235,0.3)]">
            <ShieldCheck className="w-16 h-16 text-primary animate-pulse" />
          </div>
          <h1 className="text-5xl font-bold text-white mb-4 tracking-tight drop-shadow-lg">
            GEORISE
          </h1>
          <p className="text-blue-100 text-xl font-light mb-8">
            Next-Gen Resilience & Incident Response Platform.
          </p>
          <div className="flex gap-4 text-xs font-mono text-blue-300/60 uppercase tracking-widest">
            <span className="flex items-center gap-1">
              <Activity className="w-3 h-3" /> System Operational
            </span>
            <span>•</span>
            <span>Secure Access</span>
          </div>
        </div>
      </div>

      {/* Right Side: Glass Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 bg-[url('/assets/grid_bg.svg')] bg-repeat opacity-95">
        <div className="card w-full max-w-md bg-base-100/50 backdrop-blur-xl border border-white/10 shadow-2xl">
          <div className="card-body p-8 lg:p-10">
            <div className="mb-8 text-center lg:text-left">
              <h2 className="text-3xl font-bold text-base-content mb-2">
                {t('auth.sign_in_to_account')}
              </h2>
              <p className="text-base-content/60 text-sm">
                Create, track, and manage critical incidents.
              </p>
            </div>

            {/* Custom Tabs */}
            <div className="flex p-1 bg-base-200/50 rounded-xl mb-8 relative">
              <div
                className="absolute inset-y-1 w-1/2 bg-white/10 shadow-sm rounded-lg transition-all duration-300 ease-in-out"
                style={{ transform: mode === 'EMAIL' ? 'translateX(0)' : 'translateX(100%)' }}
              ></div>
              <button
                onClick={() => setMode('EMAIL')}
                className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-medium relative z-10 transition-colors ${mode === 'EMAIL' ? 'text-primary' : 'text-base-content/60'}`}
              >
                <Mail className="w-4 h-4" /> {t('auth.email')}
              </button>
              <button
                onClick={() => setMode('OTP')}
                className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-medium relative z-10 transition-colors ${mode === 'OTP' ? 'text-primary' : 'text-base-content/60'}`}
              >
                <Smartphone className="w-4 h-4" /> {t('auth.phone')}
              </button>
            </div>

            {/* Alerts */}
            <AnimatePresence mode="wait">
              {success && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="alert alert-success shadow-lg mb-4 text-sm font-medium rounded-lg"
                >
                  <span>{success}</span>
                </motion.div>
              )}
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="alert alert-error shadow-lg mb-4 text-sm font-medium rounded-lg text-white"
                >
                  <span>{error}</span>
                </motion.div>
              )}
              {isRateLimited && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="alert alert-warning shadow-lg mb-4 text-sm font-medium rounded-lg"
                >
                  <span>{rateLimitMessage}</span>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Form Content */}
            <AnimatePresence mode="wait">
              {mode === 'EMAIL' ? (
                <motion.form
                  key="email-form"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  transition={{ duration: 0.2 }}
                  onSubmit={handleEmailLogin}
                  className="space-y-5"
                >
                  <div className="form-control">
                    <label className="label text-xs font-semibold uppercase tracking-wider text-base-content/50 mb-1">
                      {t('auth.email')}
                    </label>
                    <label className="input input-bordered flex items-center gap-3 bg-base-200/50 focus-within:ring-2 ring-primary/50 transition-all border-none h-12">
                      <Mail className="w-5 h-5 text-base-content/40" />
                      <input
                        type="email"
                        className="grow bg-transparent outline-none text-base-content placeholder:text-base-content/30"
                        placeholder="name@georise.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                      />
                    </label>
                  </div>

                  <div className="form-control">
                    <div className="flex justify-between items-center mb-1">
                      <label className="label text-xs font-semibold uppercase tracking-wider text-base-content/50 m-0 p-0">
                        {t('auth.password')}
                      </label>
                      <Link
                        to="/forgot-password"
                        className="text-xs text-primary hover:text-primary-focus transition-colors"
                      >
                        Forgot?
                      </Link>
                    </div>
                    <label className="input input-bordered flex items-center gap-3 bg-base-200/50 focus-within:ring-2 ring-primary/50 transition-all border-none h-12">
                      <Lock className="w-5 h-5 text-base-content/40" />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        className="grow bg-transparent outline-none text-base-content placeholder:text-base-content/30"
                        placeholder="••••••••"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="hover:text-primary transition-colors"
                      >
                        {showPassword ? (
                          <EyeOff className="w-5 h-5 text-base-content/40" />
                        ) : (
                          <Eye className="w-5 h-5 text-base-content/40" />
                        )}
                      </button>
                    </label>
                  </div>

                  <button
                    className="btn btn-primary w-full h-12 text-lg shadow-[0_0_20px_rgba(59,130,246,0.5)] border-none hover:shadow-[0_0_30px_rgba(59,130,246,0.7)] hover:scale-[1.02] transition-all duration-300"
                    type="submit"
                    disabled={loading || isRateLimited}
                    data-testid="login-submit"
                  >
                    {loading ? (
                      <span className="loading loading-spinner"></span>
                    ) : (
                      <span className="flex items-center gap-2">
                        {t('auth.login')} <ArrowRight className="w-5 h-5" />
                      </span>
                    )}
                  </button>
                </motion.form>
              ) : (
                <motion.div
                  key="otp-form"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.2 }}
                  className="space-y-6"
                >
                  {!otpSent ? (
                    <div className="form-control">
                      <label className="label text-xs font-semibold uppercase tracking-wider text-base-content/50 mb-1">
                        {t('auth.phone')}
                      </label>
                      <div className="flex gap-2">
                        <label className="input input-bordered flex items-center gap-3 bg-base-200/50 focus-within:ring-2 ring-primary/50 transition-all border-none h-12 flex-1">
                          <Smartphone className="w-5 h-5 text-base-content/40" />
                          <input
                            type="tel"
                            className="grow bg-transparent outline-none text-base-content"
                            value={phone}
                            onChange={(e) => setPhone(e.target.value)}
                            placeholder="+251..."
                          />
                        </label>
                        <button
                          className="btn btn-secondary h-12 px-6"
                          onClick={handleSendOtp}
                          disabled={loading || isRateLimited}
                        >
                          Send OTP
                        </button>
                      </div>
                    </div>
                  ) : (
                    <form onSubmit={handleOtpLogin} className="space-y-6">
                      <div className="form-control text-center">
                        <label className="label justify-center mb-2">
                          <span className="label-text text-base-content/70">
                            Enter code sent to{' '}
                            <span className="font-mono font-bold text-primary">{phone}</span>
                          </span>
                        </label>
                        <div className="flex justify-center">
                          <input
                            type="text"
                            className="input input-bordered w-full h-14 text-center text-2xl font-mono tracking-[0.5em] bg-base-200/50 focus:ring-2 ring-primary/50 border-none max-w-[200px]"
                            value={otpCode}
                            onChange={(e) =>
                              setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))
                            }
                            placeholder="••••••"
                            autoFocus
                          />
                        </div>
                      </div>
                      <button
                        className="btn btn-primary w-full h-12 text-lg shadow-lg hover:brightness-110"
                        type="submit"
                        disabled={loading || isRateLimited || otpCode.length < 4}
                      >
                        {loading ? (
                          <span className="loading loading-spinner"></span>
                        ) : (
                          'Verify Engine'
                        )}
                      </button>
                      <button
                        type="button"
                        className="btn btn-ghost btn-xs w-full text-base-content/50 hover:text-base-content"
                        onClick={() => setOtpSent(false)}
                      >
                        Wrong number? Change
                      </button>
                    </form>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            <div className="mt-8 pt-6 border-t border-base-content/10 text-center">
              <p className="text-sm text-base-content/60">
                New to GEORISE?{' '}
                <Link
                  to="/register"
                  className="text-primary font-semibold hover:underline decoration-2 underline-offset-4"
                >
                  Initialize Protocol
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
