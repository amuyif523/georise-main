import { useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../lib/api';

const ForgotPasswordPage = () => {
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
      setStatus(res.data.message || 'If an account exists, reset instructions have been sent.');
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to send reset instructions.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-base-200">
      <div className="card w-full max-w-md bg-base-100 shadow-xl">
        <div className="card-body space-y-4">
          <h2 className="card-title text-2xl justify-center font-bold text-primary">
            Forgot your password?
          </h2>
          <p className="text-sm text-base-content/70 text-center">
            Enter the email or phone number linked to your account. We&apos;ll send a reset code.
          </p>
          {status && <div className="alert alert-success text-sm">{status}</div>}
          {error && <div className="alert alert-error text-sm">{error}</div>}
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="form-control">
              <label className="label">
                <span className="label-text">Email or Phone</span>
              </label>
              <input
                type="text"
                className="input input-bordered w-full"
                placeholder="you@example.com or +2519..."
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                required
              />
            </div>
            <button type="submit" className={`btn btn-primary w-full ${loading ? 'loading' : ''}`}>
              {loading ? 'Sending...' : 'Send reset code'}
            </button>
          </form>

          <div className="text-center text-sm space-y-1">
            <Link to="/login" className="link link-primary">
              Back to login
            </Link>
            <div>
              Have a code already?{' '}
              <Link to="/reset-password" className="link link-secondary">
                Reset now
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ForgotPasswordPage;
