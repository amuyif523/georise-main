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
  const [email, setEmail] = useState(() => localStorage.getItem('saved_email') || '');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(() => !!localStorage.getItem('saved_email'));
  const [verifySuccess, setVerifySuccess] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [phone, setPhone] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [otpSent, setOtpSent] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [rateLimitedUntil, setRateLimitedUntil] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [resendTimer, setResendTimer] = useState(0);

  useEffect(() => {
    if (searchParams.get('registered') === 'true') {
      setSuccess(t('auth.create_account') + ' ' + t('common.success'));
    }
  }, [searchParams, t]);

  useEffect(() => {
    setError(null);
    setSuccess(null);
  }, [mode]);

  useEffect(() => {
    if (!rateLimitedUntil) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [rateLimitedUntil]);

  useEffect(() => {
    if (resendTimer > 0) {
      const t = setInterval(() => setResendTimer((prev) => prev - 1), 1000);
      return () => clearInterval(t);
    }
  }, [resendTimer]);

  const rateLimitRemainingMs =
    rateLimitedUntil && rateLimitedUntil > now ? rateLimitedUntil - now : 0;
  const isRateLimited = rateLimitRemainingMs > 0;
  const rateLimitMessage =
    rateLimitRemainingMs > 0
      ? t('auth.errors.too_many_requests_wait', { seconds: Math.ceil(rateLimitRemainingMs / 1000) })
      : null;

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading || isRateLimited) return;
    setError(null);
    setSuccess(null);
    setLoading(true);
    try {
      await login(email, password);
      if (rememberMe) {
        localStorage.setItem('saved_email', email);
      } else {
        localStorage.removeItem('saved_email');
      }
      setVerifySuccess(true);
      setTimeout(() => {
        navigate('/redirect-after-login');
      }, 1000);
    } catch (err: any) {
      handleError(err);
      setLoading(false);
    }
  };

  const handleSendOtp = async () => {
    if (loading || isRateLimited) return;
    if (!phone) {
      setError(t('auth.errors.phone_required', 'Phone number is required'));
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await api.post('/auth/otp/request', { phone });
      setOtpSent(true);
      setSuccess(t('auth.success.otp_sent', 'OTP sent to your phone.'));
      setResendTimer(60);
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
          ? t('auth.errors.too_many_requests_wait', { seconds: Math.ceil((retryMs ?? 0) / 1000) })
          : t('auth.errors.too_many_requests_retry', 'Too many requests. Please wait and retry.'),
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
            {t('app.title', 'GEORISE')}
          </h1>
          <p className="text-blue-100 text-xl font-light mb-8">
            {t('app.platform_desc', 'Next-Gen Resilience & Incident Response Platform.')}
          </p>
          <div className="flex gap-4 text-xs font-mono text-blue-300/60 uppercase tracking-widest">
            <span className="flex items-center gap-1">
              <Activity className="w-3 h-3" /> {t('app.system_operational', 'System Operational')}
            </span>
            <span>•</span>
            <span>{t('app.secure_access', 'Secure Access')}</span>
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
                {t('auth.manage_incidents_desc', 'Create, track, and manage critical incidents.')}
              </p>
            </div>

            {/* Custom Tabs */}
            <div className="flex p-1 bg-base-200/50 rounded-xl mb-8 relative overflow-hidden">
              <button
                onClick={() => setMode('EMAIL')}
                className={`flex-1 relative flex items-center justify-center gap-2 py-2 px-4 text-sm font-medium transition-colors min-w-max ${mode === 'EMAIL' ? 'text-primary' : 'text-base-content/60'}`}
              >
                {mode === 'EMAIL' && (
                  <motion.div
                    layoutId="loginTab"
                    className="absolute inset-0 bg-white/10 shadow-sm rounded-lg z-0"
                    transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                  />
                )}
                <span className="relative z-10 flex items-center gap-2">
                  <Mail className="w-4 h-4" /> {t('auth.email')}
                </span>
              </button>
              <button
                onClick={() => setMode('OTP')}
                className={`flex-1 relative flex items-center justify-center gap-2 py-2 px-4 text-sm font-medium transition-colors min-w-max ${mode === 'OTP' ? 'text-primary' : 'text-base-content/60'}`}
              >
                {mode === 'OTP' && (
                  <motion.div
                    layoutId="loginTab"
                    className="absolute inset-0 bg-white/10 shadow-sm rounded-lg z-0"
                    transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                  />
                )}
                <span className="relative z-10 flex items-center gap-2">
                  <Smartphone className="w-4 h-4" /> {t('auth.phone')}
                </span>
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
                  data-testid="login-form"
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
                        placeholder={t('auth.placeholders.email', 'name@georise.com')}
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
                        {t('auth.forgot_link', 'Forgot?')}
                      </Link>
                    </div>
                    <label className="input input-bordered flex items-center gap-3 bg-base-200/50 focus-within:ring-2 ring-primary/50 transition-all border-none h-12">
                      <Lock className="w-5 h-5 text-base-content/40" />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        className="grow bg-transparent outline-none text-base-content placeholder:text-base-content/30"
                        placeholder={t('auth.placeholders.password_login', '••••••••')}
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

                  <div className="flex justify-between items-center px-1">
                    <label className="label cursor-pointer flex items-center gap-2 m-0 p-0 hover:opacity-80 transition-opacity">
                      <input
                        type="checkbox"
                        className="checkbox checkbox-xs checkbox-primary rounded-sm"
                        checked={rememberMe}
                        onChange={(e) => setRememberMe(e.target.checked)}
                      />
                      <span className="label-text text-xs text-base-content/70 font-medium tracking-wide">
                        {t('auth.remember_me', 'Remember Me')}
                      </span>
                    </label>
                  </div>

                  <button
                    className="btn btn-primary w-full h-12 text-lg shadow-[0_0_20px_rgba(59,130,246,0.5)] border-none hover:shadow-[0_0_30px_rgba(59,130,246,0.7)] hover:scale-[1.02] transition-all duration-300"
                    type="submit"
                    disabled={loading || isRateLimited}
                    data-testid="login-submit"
                  >
                    {loading && !verifySuccess ? (
                      <span className="loading loading-spinner"></span>
                    ) : verifySuccess ? (
                      <span className="flex items-center gap-2">
                        <ShieldCheck className="w-5 h-5 text-current" />{' '}
                        {t('auth.security_verified', 'Security Verified')}
                      </span>
                    ) : (
                      <span className="flex items-center gap-2">
                        {t('auth.authorize_protocol', 'Authorize Protocol')}{' '}
                        <ArrowRight className="w-5 h-5" />
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
                            placeholder={t('auth.placeholders.phone', '+251...')}
                          />
                        </label>
                        <button
                          className="btn btn-secondary h-12 px-6"
                          onClick={handleSendOtp}
                          disabled={loading || isRateLimited}
                        >
                          {t('auth.send_otp', 'Send OTP')}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <form onSubmit={handleOtpLogin} className="space-y-6">
                      <div className="form-control text-center">
                        <label className="label justify-center mb-2">
                          <span className="label-text text-base-content/70">
                            {t('auth.enter_code_sent', 'Enter code sent to ')}
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
                            placeholder={t('auth.placeholders.otp', '••••••')}
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
                          t('auth.verify_engine', 'Verify Engine')
                        )}
                      </button>
                      <div className="flex justify-between items-center mt-4">
                        <button
                          type="button"
                          className="btn btn-ghost btn-xs text-base-content/50 hover:text-base-content"
                          onClick={() => setOtpSent(false)}
                        >
                          {t('auth.wrong_number_change', 'Wrong number? Change')}
                        </button>
                        <button
                          type="button"
                          className="btn btn-ghost btn-xs text-primary hover:text-primary/80 disabled:text-base-content/30 disabled:bg-transparent"
                          onClick={handleSendOtp}
                          disabled={resendTimer > 0 || loading || isRateLimited}
                        >
                          {resendTimer > 0
                            ? t('auth.resend_code_timer', { seconds: resendTimer })
                            : t('auth.resend_code', 'Resend Code')}
                        </button>
                      </div>
                    </form>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            <div className="mt-8 pt-6 border-t border-base-content/10 text-center">
              <p className="text-sm text-base-content/60">
                {t('auth.new_to_georise', 'New to GEORISE?')}{' '}
                <Link
                  to="/register"
                  className="text-primary font-semibold hover:underline decoration-2 underline-offset-4"
                >
                  {t('auth.initialize_profile', 'Initialize Protocol')}
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
