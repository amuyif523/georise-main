/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useEffect, useState } from 'react';
import AppLayout from '../layouts/AppLayout';
import api from '../lib/api';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ScanLine,
  Smartphone,
  ShieldCheck,
  CheckCircle,
  Lock,
  CreditCard,
  QrCode,
  Activity,
} from 'lucide-react';

const CitizenVerificationPage: React.FC = () => {
  const [nationalId, setNationalId] = useState('');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState<'ID_SCAN' | 'OTP_LINK' | 'VERIFIED'>('ID_SCAN');
  const [isScanning, setIsScanning] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    setMessage(null);
  }, [step]);

  const simulateScan = (nextAction: () => void) => {
    setIsScanning(true);
    setTimeout(() => {
      setIsScanning(false);
      nextAction();
    }, 2000); // 2 second scan effect
  };

  const handleIdSubmit = () => {
    if (!nationalId || !phone) {
      setMessage('Identity documents required.');
      return;
    }
    setLoading(true);
    simulateScan(async () => {
      try {
        const res = await api.post('/verification/request', { nationalId, phone });
        setMessage(
          res.data.otpCodeDemo
            ? `SECURE CHANNEL OPEN: ${res.data.otpCodeDemo}`
            : 'OTP sent via encrypted SMS.',
        );
        setStep('OTP_LINK');
      } catch (err: any) {
        setMessage(err?.response?.data?.message || 'Verification Protocol Failed');
      } finally {
        setLoading(false);
      }
    });
  };

  const handleOtpSubmit = async () => {
    setLoading(true);
    try {
      await api.post('/verification/confirm-otp', { otpCode: otp });
      setStep('VERIFIED');
    } catch (err: any) {
      setMessage(err?.response?.data?.message || 'Invalid Authentication Code');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AppLayout>
      <div className="flex flex-col items-center justify-center min-h-[600px] max-w-4xl mx-auto">
        {/* Header Section */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold tracking-tight mb-2 flex items-center justify-center gap-3">
            <ShieldCheck className="w-10 h-10 text-primary" />
            Identity Verification Protocol
          </h1>
          <p className="text-base-content/60 font-mono uppercase tracking-widest text-sm">
            Trust Anchor Level 1 Clearance
          </p>
        </div>

        <div className="card w-full max-w-2xl bg-base-100 shadow-2xl border border-base-content/10 overflow-hidden relative">
          {/* Scanning Overlay */}
          <AnimatePresence>
            {isScanning && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 z-50 bg-black/80 flex flex-col items-center justify-center backdrop-blur-sm"
              >
                <div className="relative w-64 h-40 border-2 border-primary/50 rounded-lg overflow-hidden bg-primary/5">
                  <motion.div
                    animate={{ top: ['0%', '100%', '0%'] }}
                    transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                    className="absolute left-0 right-0 h-1 bg-primary shadow-[0_0_20px_rgba(37,99,235,1)]"
                  />
                  <div className="absolute inset-0 grid grid-cols-6 grid-rows-4 gap-1 opacity-20">
                    {Array.from({ length: 24 }).map((_, i) => (
                      <div key={i} className="border border-primary/30"></div>
                    ))}
                  </div>
                </div>
                <div className="mt-4 font-mono text-primary animate-pulse">
                  ANALYZING BIOMETRIC HASH...
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="card-body p-8 lg:p-12">
            {/* Progress Steps */}
            <div className="flex items-center justify-center mb-10 w-full">
              <div
                className={`flex flex-col items-center ${step === 'ID_SCAN' ? 'text-primary' : 'text-success'} transition-colors`}
              >
                <div
                  className={`w-10 h-10 rounded-full border-2 flex items-center justify-center font-bold mb-2 ${step === 'ID_SCAN' ? 'border-primary bg-primary/10' : 'border-success bg-success/10'}`}
                >
                  1
                </div>
                <span className="text-xs font-bold uppercase tracking-wider">Credentials</span>
              </div>
              <div className={`w-20 h-1 bg-base-content/10 mx-4 relative`}>
                <motion.div
                  className="absolute top-0 left-0 h-full bg-success"
                  initial={{ width: '0%' }}
                  animate={{ width: step === 'ID_SCAN' ? '0%' : '100%' }}
                />
              </div>
              <div
                className={`flex flex-col items-center ${step === 'OTP_LINK' ? 'text-primary' : step === 'VERIFIED' ? 'text-success' : 'text-base-content/30'} transition-colors`}
              >
                <div
                  className={`w-10 h-10 rounded-full border-2 flex items-center justify-center font-bold mb-2 ${step === 'OTP_LINK' ? 'border-primary bg-primary/10' : step === 'VERIFIED' ? 'border-success bg-success' : 'border-base-content/10'}`}
                >
                  2
                </div>
                <span className="text-xs font-bold uppercase tracking-wider">Link</span>
              </div>
              <div className={`w-20 h-1 bg-base-content/10 mx-4 relative`}>
                <motion.div
                  className="absolute top-0 left-0 h-full bg-success"
                  initial={{ width: '0%' }}
                  animate={{ width: step === 'VERIFIED' ? '100%' : '0%' }}
                />
              </div>
              <div
                className={`flex flex-col items-center ${step === 'VERIFIED' ? 'text-success' : 'text-base-content/30'} transition-colors`}
              >
                <div
                  className={`w-10 h-10 rounded-full border-2 flex items-center justify-center font-bold mb-2 ${step === 'VERIFIED' ? 'border-success bg-success text-white shadow-[0_0_20px_rgba(34,197,94,0.5)]' : 'border-base-content/10'}`}
                >
                  <CheckCircle className="w-5 h-5" />
                </div>
                <span className="text-xs font-bold uppercase tracking-wider">Authorized</span>
              </div>
            </div>

            <AnimatePresence mode="wait">
              {message && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="alert alert-info shadow-sm mb-6 font-mono text-xs"
                >
                  <Activity className="w-4 h-4" /> {message}
                </motion.div>
              )}
            </AnimatePresence>

            {step === 'ID_SCAN' && (
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="space-y-6"
              >
                <div className="form-control">
                  <label className="label">
                    <span className="label-text font-bold">National ID / Resident Card</span>
                  </label>
                  <label className="input input-bordered flex items-center gap-3 h-14 bg-base-200 focus-within:ring-2 ring-primary/50 transition-all">
                    <CreditCard className="w-5 h-5 text-base-content/40" />
                    <input
                      type="text"
                      className="grow font-mono uppercase tracking-widest"
                      placeholder="ID-XXXXXXXX"
                      value={nationalId}
                      onChange={(e) => setNationalId(e.target.value)}
                    />
                    <ScanLine className="w-5 h-5 text-base-content/30" />
                  </label>
                </div>

                <div className="form-control">
                  <label className="label">
                    <span className="label-text font-bold">Registered Mobile Number</span>
                  </label>
                  <label className="input input-bordered flex items-center gap-3 h-14 bg-base-200 focus-within:ring-2 ring-primary/50 transition-all">
                    <Smartphone className="w-5 h-5 text-base-content/40" />
                    <input
                      type="tel"
                      className="grow font-mono"
                      placeholder="+251..."
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                    />
                  </label>
                </div>

                <button
                  className="btn btn-primary w-full h-12 text-lg shadow-lg hover:brightness-110 mt-4"
                  onClick={handleIdSubmit}
                  disabled={loading}
                >
                  {loading ? (
                    'Processing...'
                  ) : (
                    <span className="flex items-center gap-2">
                      Initiate Scan <ScanLine className="w-4 h-4" />
                    </span>
                  )}
                </button>
              </motion.div>
            )}

            {step === 'OTP_LINK' && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="space-y-6 text-center"
              >
                <div className="flex justify-center mb-4">
                  <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center">
                    <Lock className="w-10 h-10 text-primary" />
                  </div>
                </div>
                <h3 className="text-xl font-bold">Two-Factor Authorization</h3>
                <p className="text-sm opacity-60">
                  Enter the cryptographic token sent to your device.
                </p>

                <div className="flex justify-center my-6">
                  <input
                    type="text"
                    className="input input-bordered w-full max-w-[200px] text-center text-3xl font-mono tracking-[0.5em] h-16 bg-base-200 focus:ring-2 ring-primary"
                    placeholder="000000"
                    maxLength={6}
                    value={otp}
                    onChange={(e) => setOtp(e.target.value)}
                    autoFocus
                  />
                </div>

                <button
                  className="btn btn-primary w-full h-12 text-lg shadow-lg hover:brightness-110"
                  onClick={handleOtpSubmit}
                  disabled={loading || otp.length < 4}
                >
                  {loading ? 'Verifying...' : 'Authenticate'}
                </button>
              </motion.div>
            )}

            {step === 'VERIFIED' && (
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="text-center py-8"
              >
                <div className="relative inline-block mb-6">
                  <motion.div
                    animate={{ scale: [1, 1.1, 1] }}
                    transition={{ duration: 2, repeat: Infinity }}
                    className="absolute inset-0 bg-success/20 rounded-full blur-xl"
                  ></motion.div>
                  <ShieldCheck className="w-24 h-24 text-success relative z-10" />
                </div>
                <h2 className="text-3xl font-bold text-success mb-2">CLEARANCE GRANTED</h2>
                <p className="text-lg text-base-content/70 mb-8">
                  Your identity has been cryptographically verified.
                  <br />
                  You are now a <strong>Trusted Responder</strong>.
                </p>

                <div className="grid grid-cols-2 gap-4 text-left max-w-sm mx-auto mb-8 bg-base-200 p-4 rounded-lg">
                  <div className="flex items-center gap-2 text-sm">
                    <CheckCircle className="w-4 h-4 text-success" />
                    <span>Priority Routing</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <CheckCircle className="w-4 h-4 text-success" />
                    <span>Direct Dispatch</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <CheckCircle className="w-4 h-4 text-success" />
                    <span>Location Trust</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <CheckCircle className="w-4 h-4 text-success" />
                    <span>Badge Unlocked</span>
                  </div>
                </div>

                <button
                  className="btn btn-outline w-full"
                  onClick={() => (window.location.href = '/citizen/dashboard')}
                >
                  Return to Command Center
                </button>
              </motion.div>
            )}
          </div>
          {/* Security Footer */}
          <div className="bg-base-200/50 p-4 border-t border-base-content/5 flex justify-between items-center text-[10px] text-base-content/40 font-mono uppercase">
            <span className="flex items-center gap-1">
              <QrCode className="w-3 h-3" /> Secure Protocol v2.4
            </span>
            <span>Encrypted E2E</span>
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

export default CitizenVerificationPage;
