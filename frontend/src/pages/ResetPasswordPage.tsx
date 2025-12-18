import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import api from '../lib/api';

const ResetPasswordPage = () => {
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
      setStatus(res.data.message || 'Password updated. You can log in now.');
    } catch (err: unknown) {
      const message =
        err && typeof err === 'object' && 'response' in err
          ? // @ts-expect-error - best-effort message extraction
            err.response?.data?.message
          : null;
      setError(message || 'Reset failed. Check your code and try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-base-200">
      <div className="card w-full max-w-md bg-base-100 shadow-xl">
        <div className="card-body space-y-4">
          <h2 className="card-title text-2xl justify-center font-bold text-primary">
            Reset your password
          </h2>
          <p className="text-sm text-base-content/70 text-center">
            Enter the reset code you received and choose a new password.
          </p>
          {status && <div className="alert alert-success text-sm">{status}</div>}
          {error && <div className="alert alert-error text-sm">{error}</div>}
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="form-control">
              <label className="label">
                <span className="label-text">Reset code</span>
              </label>
              <input
                type="text"
                className="input input-bordered w-full"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="Paste code from SMS/email"
                required
              />
            </div>
            <div className="form-control">
              <label className="label">
                <span className="label-text">New password</span>
              </label>
              <input
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
              {loading ? 'Saving...' : 'Update password'}
            </button>
          </form>

          <div className="text-center text-sm space-y-1">
            <Link to="/login" className="link link-primary">
              Back to login
            </Link>
            <div>
              Need a new code?{' '}
              <Link to="/forgot-password" className="link link-secondary">
                Request again
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ResetPasswordPage;
