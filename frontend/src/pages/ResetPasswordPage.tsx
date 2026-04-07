import { useState } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import api from '../lib/api';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, Eye, EyeOff } from 'lucide-react';

const ResetPasswordPage = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [token, setToken] = useState(searchParams.get('token') || '');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [successAnim, setSuccessAnim] = useState(false);

  const getStrength = (pass: string) => {
    if (pass.length === 0) return 0;
    let s = 0;
    if (pass.length >= 8) s++;
    if (/[A-Z]/.test(pass)) s++;
    if (/[0-9]/.test(pass)) s++;
    if (/[^A-Za-z0-9]/.test(pass)) s++;
    return s;
  };

  const strength = getStrength(password);
  const strengthColor =
    strength === 0
      ? 'bg-base-300'
      : strength < 2
        ? 'bg-error'
        : strength < 3
          ? 'bg-warning'
          : 'bg-success';
  const strengthLabel =
    strength < 2
      ? t('auth.password_weak', 'Weak')
      : strength < 3
        ? t('auth.password_medium', 'Medium')
        : t('auth.password_strong', 'Strong');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus(null);
    setError(null);
    setLoading(true);
    try {
      const res = await api.post('/auth/password-reset/confirm', {
        token: token.trim(),
        password,
      });
      setStatus(res.data.message || t('auth.reset_success'));
      setSuccessAnim(true);
      setTimeout(() => navigate('/login'), 2000);
    } catch (err: unknown) {
      const message =
        err && typeof err === 'object' && 'response' in err
          ? // @ts-expect-error - best-effort message extraction
            err.response?.data?.message
          : null;
      setError(message || t('auth.reset_failed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-base-200">
      <div className="card w-full max-w-md bg-base-100 shadow-xl">
        <div className="card-body space-y-4">
          <h2 className="card-title text-2xl justify-center font-bold text-primary">
            {t('auth.reset_title')}
          </h2>
          <p className="text-sm text-base-content/70 text-center">{t('auth.reset_subtitle')}</p>
          {status && (
            <div
              className="alert alert-success text-sm break-words"
              role="status"
              aria-live="polite"
            >
              {status}
            </div>
          )}
          {error && (
            <div
              className="alert alert-error text-sm break-words"
              role="alert"
              aria-live="assertive"
            >
              {error}
            </div>
          )}
          <AnimatePresence mode="wait">
            {!successAnim ? (
              <motion.form
                key="reset-form"
                initial={{ opacity: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                onSubmit={handleSubmit}
                className="space-y-3"
              >
                <div className="form-control">
                  <label className="label" htmlFor="reset-code">
                    <span className="label-text">{t('auth.reset_code')}</span>
                  </label>
                  <input
                    id="reset-code"
                    type="text"
                    className="input input-bordered w-full font-mono tracking-widest uppercase"
                    value={token}
                    onChange={(e) => setToken(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="••••••"
                    required
                  />
                </div>
                <div className="form-control mb-1">
                  <label className="label" htmlFor="new-password">
                    <span className="label-text">{t('auth.new_password')}</span>
                  </label>
                  <div className="relative">
                    <input
                      id="new-password"
                      type={showPassword ? 'text' : 'password'}
                      className="input input-bordered w-full pr-12"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      minLength={8}
                      required
                    />
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm absolute right-1 top-1/2 -translate-y-1/2"
                      onClick={() => setShowPassword((prev) => !prev)}
                      aria-label={
                        showPassword
                          ? t('auth.hide_password', 'Hide password')
                          : t('auth.show_password', 'Show password')
                      }
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {password.length > 0 && (
                    <div className="mt-2 space-y-1">
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-base-content/60">Strength</span>
                        <span
                          className={`font-semibold ${strength < 2 ? 'text-error' : strength < 3 ? 'text-warning' : 'text-success'}`}
                        >
                          {strengthLabel}
                        </span>
                      </div>
                      <div className="w-full bg-base-300 rounded-full h-1.5 overflow-hidden flex">
                        <motion.div
                          className={`h-full ${strengthColor}`}
                          initial={{ width: 0 }}
                          animate={{ width: `${(strength / 4) * 100}%` }}
                          transition={{ duration: 0.3 }}
                        />
                      </div>
                    </div>
                  )}
                </div>
                <button
                  type="submit"
                  className={`btn btn-primary w-full ${loading ? 'opacity-80' : ''}`}
                  disabled={loading || token.length < 6 || strength < 2}
                >
                  {loading ? (
                    <span className="loading loading-spinner"></span>
                  ) : (
                    t('auth.update_password')
                  )}
                </button>
              </motion.form>
            ) : (
              <motion.div
                key="success-check"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex flex-col items-center justify-center space-y-4 py-8"
              >
                <motion.div
                  initial={{ rotate: -180, opacity: 0 }}
                  animate={{ rotate: 0, opacity: 1 }}
                  transition={{ type: 'spring', stiffness: 200, damping: 20 }}
                >
                  <CheckCircle className="w-20 h-20 text-success" />
                </motion.div>
                <h3 className="text-xl font-bold text-success">{t('auth.security_verified')}</h3>
                <p className="text-sm text-base-content/70">Redirecting to terminal...</p>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="text-center text-sm space-y-1">
            <Link to="/login" className="link link-primary">
              {t('auth.back_to_login')}
            </Link>
            <div>
              {t('auth.need_new_code')}{' '}
              <Link to="/forgot-password" className="link link-secondary">
                {t('auth.request_again')}
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ResetPasswordPage;
