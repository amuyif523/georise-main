/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useEffect } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../lib/api';
import { useTranslation } from 'react-i18next';
import LanguageSwitcher from '../components/LanguageSwitcher';

const LoginPage: React.FC = () => {
  const { t } = useTranslation();
  const { login, setAuth } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [mode, setMode] = useState<'EMAIL' | 'OTP'>('EMAIL');
  const [email, setEmail] = useState('citizen@example.com');
  const [password, setPassword] = useState('password123');
  const [phone, setPhone] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [otpSent, setOtpSent] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (searchParams.get('registered') === 'true') {
      setSuccess(t('auth.create_account') + ' ' + t('common.success'));
    }
  }, [searchParams, t]);

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setError(null);
    setSuccess(null);
    setLoading(true);
    try {
      await login(email, password);
      navigate('/redirect-after-login');
    } catch (err: any) {
      setError(err?.response?.data?.message || t('common.error'));
    } finally {
      setLoading(false);
    }
  };

  const handleSendOtp = async () => {
    if (loading) return;
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
      setError(err?.response?.data?.message || 'Failed to send OTP');
    } finally {
      setLoading(false);
    }
  };

  const handleOtpLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setError(null);
    setLoading(true);
    try {
      const res = await api.post('/auth/otp/verify', { phone, code: otpCode });
      setAuth(res.data.user, res.data.token, res.data.refreshToken);
      navigate('/redirect-after-login');
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Invalid OTP');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-base-200 relative">
      <div className="absolute top-4 right-4">
        <LanguageSwitcher />
      </div>
      <div className="card w-full max-w-md bg-base-100 shadow-xl">
        <div className="card-body">
          <h2 className="card-title mb-4 justify-center text-2xl font-bold text-primary">
            {t('auth.sign_in_to_account')}
          </h2>

          <div className="tabs tabs-boxed justify-center mb-4">
            <a
              className={`tab ${mode === 'EMAIL' ? 'tab-active' : ''}`}
              onClick={() => setMode('EMAIL')}
            >
              {t('auth.email')}
            </a>
            <a
              className={`tab ${mode === 'OTP' ? 'tab-active' : ''}`}
              onClick={() => setMode('OTP')}
            >
              {t('auth.phone')}
            </a>
          </div>

          {success && <div className="alert alert-success mb-3 text-sm">{success}</div>}
          {error && <div className="alert alert-error mb-3 text-sm">{error}</div>}

          {mode === 'EMAIL' ? (
            <form onSubmit={handleEmailLogin} className="space-y-4">
              <div className="form-control">
                <label className="label">
                  <span className="label-text">{t('auth.email')}</span>
                </label>
                <input
                  type="email"
                  className="input input-bordered w-full"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>

              <div className="form-control">
                <label className="label">
                  <span className="label-text">{t('auth.password')}</span>
                </label>
                <input
                  type="password"
                  className="input input-bordered w-full"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <div className="text-right mt-1">
                  <Link to="/forgot-password" className="link link-secondary text-xs">
                    Forgot password?
                  </Link>
                </div>
              </div>

              <div className="form-control mt-6">
                <button
                  className={`btn btn-primary w-full ${loading ? 'loading' : ''}`}
                  type="submit"
                  disabled={loading}
                >
                  {loading ? t('common.loading') : t('auth.login')}
                </button>
              </div>
            </form>
          ) : (
            <div className="space-y-4">
              {!otpSent ? (
                <div className="form-control">
                  <label className="label">
                    <span className="label-text">{t('auth.phone')}</span>
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="tel"
                      className="input input-bordered w-full"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+251..."
                    />
                    <button
                      className={`btn btn-secondary ${loading ? 'loading' : ''}`}
                      onClick={handleSendOtp}
                      disabled={loading}
                    >
                      Send OTP
                    </button>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleOtpLogin} className="space-y-4">
                  <div className="form-control">
                    <label className="label">
                      <span className="label-text">Enter OTP Code</span>
                    </label>
                    <input
                      type="text"
                      className="input input-bordered w-full text-center tracking-widest text-xl"
                      value={otpCode}
                      onChange={(e) => setOtpCode(e.target.value)}
                      placeholder="123456"
                      maxLength={6}
                    />
                  </div>
                  <div className="form-control mt-6">
                    <button
                      className={`btn btn-primary w-full ${loading ? 'loading' : ''}`}
                      type="submit"
                      disabled={loading}
                    >
                      Verify & Login
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost btn-xs mt-2"
                      onClick={() => setOtpSent(false)}
                    >
                      Change Phone Number
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}

          <div className="divider">OR</div>
          <div className="text-center">
            <p className="text-sm">
              Don't have an account?{' '}
              <Link to="/register" className="link link-primary">
                Sign up here
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
