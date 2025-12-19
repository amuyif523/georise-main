import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import api from '../lib/api';
import { useTranslation } from 'react-i18next';

const ResetPasswordPage = () => {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const [token, setToken] = useState(searchParams.get('token') || '');
  const [password, setPassword] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus(null);
    setError(null);
    setLoading(true);
    try {
      const res = await api.post('/auth/password-reset/confirm', { token, password });
      setStatus(res.data.message || t('auth.reset_success'));
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
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="form-control">
              <label className="label" htmlFor="reset-code">
                <span className="label-text">{t('auth.reset_code')}</span>
              </label>
              <input
                id="reset-code"
                type="text"
                className="input input-bordered w-full"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="Paste code from SMS/email"
                required
              />
            </div>
            <div className="form-control">
              <label className="label" htmlFor="new-password">
                <span className="label-text">{t('auth.new_password')}</span>
              </label>
              <input
                id="new-password"
                type="password"
                className="input input-bordered w-full"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                minLength={8}
                required
              />
            </div>
            <button type="submit" className={`btn btn-primary w-full ${loading ? 'loading' : ''}`}>
              {loading ? t('auth.saving') : t('auth.update_password')}
            </button>
          </form>

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
