/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../lib/api';
import { useTranslation } from 'react-i18next';
import LanguageSwitcher from '../components/LanguageSwitcher';
import { motion, AnimatePresence } from 'framer-motion';
import {
  User,
  Mail,
  Smartphone,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  ShieldCheck,
  Activity,
} from 'lucide-react';

const RegisterPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const validatePhone = (p: string) => /^\+251[79]\d{8}$/.test(p);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (phone && !validatePhone(phone)) {
      setError(t('auth.errors.invalid_phone', 'Invalid phone number format. Must be +251...'));
      return;
    }

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
      setError(
        err?.response?.data?.message || t('auth.errors.registration_failed', 'Registration failed'),
      );
    } finally {
      setLoading(false);
    }
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, x: -20 },
    visible: { opacity: 1, x: 0 },
  };

  return (
    <div className="min-h-screen flex bg-base-200 font-sans">
      {/* Absolute Language Switcher */}
      <div className="absolute top-6 right-6 z-50">
        <LanguageSwitcher />
      </div>

      {/* Left Side: Hero Visual (Reused for consistency) */}
      <div className="hidden lg:flex lg:w-1/2 relative bg-neutral overflow-hidden items-center justify-center">
        <div className="absolute inset-0 bg-gradient-to-t from-neutral to-transparent z-10 opacity-90"></div>
        <img
          src="/assets/login_hero.png"
          alt="Cyber Command"
          className="absolute inset-0 w-full h-full object-cover opacity-60"
        />
        <div className="relative z-20 max-w-lg px-12 text-center items-center flex flex-col">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.8 }}
            className="mb-6 p-4 bg-secondary/20 backdrop-blur-sm rounded-full inline-block border border-secondary/40 shadow-[0_0_30px_rgba(34,197,94,0.3)]"
          >
            <ShieldCheck className="w-16 h-16 text-secondary animate-pulse" />
          </motion.div>
          <h1 className="text-5xl font-bold text-white mb-4 tracking-tight drop-shadow-lg">
            {t('auth.join_network', 'JOIN THE NETWORK')}
          </h1>
          <p className="text-base-content/70 text-xl font-light mb-8">
            {t(
              'auth.join_citizen_desc',
              'Join as a Citizen. Verify your identity to become a Responder.',
            )}
          </p>
          <div className="flex gap-4 text-xs font-mono text-secondary/60 uppercase tracking-widest">
            <span className="flex items-center gap-1">
              <Activity className="w-3 h-3" /> {t('auth.registration_open', 'Registration Open')}
            </span>
            <span>•</span>
            <span>{t('auth.encrypted_channel', 'Encrypted Channel')}</span>
          </div>
        </div>
      </div>

      {/* Right Side: Glass Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 bg-[url('/assets/grid_bg.svg')] bg-repeat opacity-95">
        <div className="card w-full max-w-md bg-base-100/50 backdrop-blur-xl border border-white/10 shadow-2xl relative overflow-hidden">
          {/* Decorative top border */}
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-secondary to-transparent"></div>

          <div className="card-body p-8 lg:p-10">
            <div className="mb-6 text-center lg:text-left">
              <h2 className="text-3xl font-bold text-base-content mb-2">
                {t('auth.initialize_profile', 'Initialize Profile')}
              </h2>
              <p className="text-base-content/60 text-sm">
                {t('auth.create_secure_identity', 'Create your secure access identity.')}
              </p>
            </div>

            <AnimatePresence>
              {error && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="alert alert-error shadow-lg mb-4 text-sm font-medium rounded-lg text-white"
                >
                  <span>{error}</span>
                </motion.div>
              )}
            </AnimatePresence>

            <motion.form
              variants={containerVariants}
              initial="hidden"
              animate="visible"
              onSubmit={handleSubmit}
              className="space-y-4"
              data-testid="register-form"
            >
              <motion.div variants={itemVariants} className="form-control">
                <label
                  htmlFor="fullName"
                  className="label text-xs font-semibold uppercase tracking-wider text-base-content/50 mb-1"
                >
                  {t('auth.full_name', 'Full Name')}
                </label>
                <label className="input input-bordered flex items-center gap-3 bg-base-200/50 focus-within:ring-2 ring-secondary/50 transition-all border-none h-12">
                  <User className="w-5 h-5 text-base-content/40" />
                  <input
                    id="fullName"
                    type="text"
                    className="grow bg-transparent outline-none text-base-content placeholder:text-base-content/30"
                    placeholder={t('auth.placeholders.fullname', 'Abebe Bikila')}
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required
                    minLength={2}
                  />
                </label>
              </motion.div>

              <motion.div variants={itemVariants} className="form-control">
                <label
                  htmlFor="email"
                  className="label text-xs font-semibold uppercase tracking-wider text-base-content/50 mb-1"
                >
                  {t('auth.email')}
                </label>
                <label className="input input-bordered flex items-center gap-3 bg-base-200/50 focus-within:ring-2 ring-secondary/50 transition-all border-none h-12">
                  <Mail className="w-5 h-5 text-base-content/40" />
                  <input
                    id="email"
                    type="email"
                    className="grow bg-transparent outline-none text-base-content placeholder:text-base-content/30"
                    placeholder={t('auth.placeholders.email', 'name@georise.com')}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </label>
              </motion.div>

              <motion.div variants={itemVariants} className="form-control">
                <label
                  htmlFor="phone"
                  className="label text-xs font-semibold uppercase tracking-wider text-base-content/50 mb-1"
                >
                  {t('auth.phone')} (Optional)
                </label>
                <label className="input input-bordered flex items-center gap-3 bg-base-200/50 focus-within:ring-2 ring-secondary/50 transition-all border-none h-12">
                  <Smartphone className="w-5 h-5 text-base-content/40" />
                  <input
                    id="phone"
                    type="tel"
                    className="grow bg-transparent outline-none text-base-content placeholder:text-base-content/30"
                    placeholder={t('auth.placeholders.phone', '+251...')}
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                  />
                </label>
              </motion.div>

              <motion.div variants={itemVariants} className="form-control">
                <label
                  htmlFor="password"
                  className="label text-xs font-semibold uppercase tracking-wider text-base-content/50 mb-1"
                >
                  {t('auth.password')}
                </label>
                <label className="input input-bordered flex items-center gap-3 bg-base-200/50 focus-within:ring-2 ring-secondary/50 transition-all border-none h-12">
                  <Lock className="w-5 h-5 text-base-content/40" />
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    className="grow bg-transparent outline-none text-base-content placeholder:text-base-content/30"
                    placeholder={t('auth.placeholders.password_create', 'Create a strong password')}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="hover:text-secondary transition-colors"
                  >
                    {showPassword ? (
                      <EyeOff className="w-5 h-5 text-base-content/40" />
                    ) : (
                      <Eye className="w-5 h-5 text-base-content/40" />
                    )}
                  </button>
                </label>
              </motion.div>

              <motion.div variants={itemVariants} className="pt-2">
                <button
                  className="btn btn-secondary w-full h-12 text-lg shadow-[0_0_20px_rgba(34,197,94,0.4)] border-none hover:shadow-[0_0_30px_rgba(34,197,94,0.6)] hover:scale-[1.02] transition-all duration-300"
                  type="submit"
                  disabled={loading}
                >
                  {loading ? (
                    <span className="loading loading-spinner"></span>
                  ) : (
                    <span className="flex items-center gap-2">
                      {t('auth.authorize_protocol', 'Authorize Protocol')}{' '}
                      <ArrowRight className="w-5 h-5" />
                    </span>
                  )}
                </button>
              </motion.div>
            </motion.form>

            <div className="mt-8 pt-6 border-t border-base-content/10 text-center">
              <p className="text-sm text-base-content/60">
                {t('auth.have_credentials', 'Already have credentials?')}{' '}
                <Link
                  to="/login"
                  className="text-secondary font-semibold hover:underline decoration-2 underline-offset-4"
                >
                  {t('auth.access_terminal', 'Access Terminal')}
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RegisterPage;
