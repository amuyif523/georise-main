/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../lib/api';

const RegisterPage: React.FC = () => {
  const navigate = useNavigate();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await api.post('/auth/register', {
        fullName,
        email,
        password,
        phone: phone || undefined,
        role: 'CITIZEN',
      });
      navigate('/login?registered=true');
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-base-200">
      <div className="card w-full max-w-md bg-base-100 shadow-xl">
        <div className="card-body">
          <h2 className="card-title mb-4 justify-center text-2xl font-bold text-primary">
            Create Account
          </h2>
          {error && <div className="alert alert-error mb-3 text-sm">{error}</div>}

          <form data-testid="register-form" onSubmit={handleSubmit} className="space-y-4">
            <div className="form-control">
              <label className="label" htmlFor="fullName">
                <span className="label-text">Full Name</span>
              </label>
              <input
                id="fullName"
                type="text"
                className="input input-bordered w-full"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                minLength={2}
              />
            </div>

            <div className="form-control">
              <label className="label" htmlFor="email">
                <span className="label-text">Email</span>
              </label>
              <input
                id="email"
                type="email"
                className="input input-bordered w-full"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div className="form-control">
              <label className="label" htmlFor="phone">
                <span className="label-text">Phone (Recommended)</span>
              </label>
              <input
                id="phone"
                type="tel"
                className="input input-bordered w-full"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+251..."
              />
              <label className="label">
                <span className="label-text-alt text-gray-500">
                  Used for urgent alerts and OTP login
                </span>
              </label>
            </div>

            <div className="form-control">
              <label className="label" htmlFor="password">
                <span className="label-text">Password</span>
              </label>
              <input
                id="password"
                type="password"
                className="input input-bordered w-full"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
              />
            </div>

            <div className="form-control mt-6">
              <button
                className={`btn btn-primary w-full ${loading ? 'loading' : ''}`}
                type="submit"
                disabled={loading}
              >
                {loading ? 'Creating Account...' : 'Sign Up'}
              </button>
            </div>
          </form>

          <div className="divider">OR</div>
          <div className="text-center">
            <p className="text-sm">
              Already have an account?{' '}
              <Link to="/login" className="link link-primary">
                Log in here
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RegisterPage;
