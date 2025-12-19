import { useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../lib/api';
import { useTranslation } from 'react-i18next';

const ForgotPasswordPage = () => {
  const { t } = useTranslation();
  const [identifier, setIdentifier] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus(null);
    setError(null);
    setLoading(true);
    try {
      const res = await api.post('/auth/password-reset/request', { identifier });
      setStatus(res.data.message || t('auth.reset_request_success'));
    } catch (err: unknown) {
      const message =
        err && typeof err === 'object' && 'response' in err
          ? // @ts-expect-error - best-effort message extraction
            err.response?.data?.message
          : null;
      setError(message || t('auth.reset_request_failed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-base-200">
      <div className="card w-full max-w-md bg-base-100 shadow-xl">
        <div className="card-body space-y-4">
          <h2 className="card-title text-2xl justify-center font-bold text-primary">
            {t('auth.forgot_title')}
          </h2>
          <p className="text-sm text-base-content/70 text-center">{t('auth.forgot_subtitle')}</p>
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
              <label className="label" htmlFor="identifier">
                <span className="label-text">{t('auth.email_or_phone')}</span>
              </label>
              <input
                id="identifier"
                type="text"
                className="input input-bordered w-full"
                placeholder="you@example.com or +2519..."
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                required
              />
            </div>
            <button type="submit" className={`btn btn-primary w-full ${loading ? 'loading' : ''}`}>
              {loading ? t('auth.sending') : t('auth.send_reset_code')}
            </button>
          </form>

          <div className="text-center text-sm space-y-1">
            <Link to="/login" className="link link-primary">
              {t('auth.back_to_login')}
            </Link>
            <div>
              {t('auth.have_code')}{' '}
              <Link to="/reset-password" className="link link-secondary">
                {t('auth.reset_now')}
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ForgotPasswordPage;
