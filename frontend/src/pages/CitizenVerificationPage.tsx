/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldCheck, Upload, FileText, Clock, CheckCircle, AlertTriangle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import AppLayout from '../layouts/AppLayout';
import api from '../lib/api';
import { useAuth } from '../context/AuthContext';

type VerifStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | null;

const CitizenVerificationPage: React.FC = () => {
  const { t } = useTranslation();
  const { user, refreshUser } = useAuth();

  // Form state
  const [idNumber, setIdNumber] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Determine initial status from AuthContext (which now includes verificationRequest)
  const currentStatus: VerifStatus = user?.isVerified
    ? 'APPROVED'
    : (user?.verificationRequest?.status as VerifStatus) || null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] ?? null;
    setFile(f);
    if (f) {
      const reader = new FileReader();
      reader.onload = (ev) => setFilePreview(ev.target?.result as string);
      reader.readAsDataURL(f);
    } else {
      setFilePreview(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!idNumber.trim() || !file) {
      setError('Please fill in your ID number and upload a photo.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const form = new FormData();
      form.append('idNumber', idNumber.trim());
      form.append('idPhoto', file);
      await api.post('/users/verify', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      // Force refresh the user object in AuthContext to update the UI globally
      await refreshUser();
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Submission failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AppLayout>
      <div className="max-w-2xl mx-auto py-8 px-4">
        {/* Header */}
        <div className="mb-8 flex items-center gap-4">
          <div className="p-3 bg-primary/10 rounded-xl border border-primary/20">
            <ShieldCheck className="w-8 h-8 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-base-content">
              {t('verify.identity_terminal', 'Identity Terminal')}
            </h1>
            <p className="text-sm text-base-content/60 font-mono tracking-wide">
              GEORISE · KYC Clearance Protocol
            </p>
          </div>
        </div>

        {!user ? (
          <div className="flex justify-center py-20">
            <span className="loading loading-spinner loading-lg text-primary"></span>
          </div>
        ) : (
          <AnimatePresence mode="wait">
            {/* ─── STATE C: VERIFIED (APPROVED) ─── */}
            {currentStatus === 'APPROVED' && (
              <motion.div
                key="verified"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="card bg-base-100/60 backdrop-blur-xl border border-success/30 shadow-[0_0_40px_rgba(34,197,94,0.15)] p-8 text-center space-y-6"
              >
                {/* Pulsing Shield */}
                <div className="relative flex justify-center py-4">
                  <motion.div
                    animate={{ scale: [1, 1.15, 1] }}
                    transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
                    className="absolute w-32 h-32 rounded-full bg-success/10"
                  />
                  <div className="relative p-6 bg-success/10 rounded-full border border-success/30 shadow-[0_0_30px_rgba(34,197,94,0.3)]">
                    <ShieldCheck className="w-14 h-14 text-success" />
                  </div>
                </div>

                <div>
                  <h2 className="text-2xl font-black text-success mb-1">
                    {t('verify.secure_identity_verified', 'Secure Identity Verified')}
                  </h2>
                  <p className="text-sm text-base-content/60 font-mono">
                    {t('verify.biometric_sync', 'Biometric Sync Complete')}
                  </p>
                </div>

                {/* Trust Score Summary */}
                <div className="bg-base-200/60 rounded-xl p-6 border border-base-content/10 text-left space-y-3">
                  <h3 className="text-xs font-bold uppercase tracking-widest text-base-content/40">
                    Clearance Matrix
                  </h3>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-base-content/70">Trust Score</span>
                    <span className="font-black text-2xl text-success">
                      {user?.trustScore ?? 0}
                    </span>
                  </div>
                  <div className="w-full bg-base-300 rounded-full h-2 overflow-hidden">
                    <motion.div
                      className="h-full bg-success rounded-full"
                      initial={{ width: 0 }}
                      animate={{
                        width: `${Math.min(((user?.trustScore ?? 0) / 100) * 100, 100)}%`,
                      }}
                      transition={{ duration: 1.2, ease: 'easeOut' }}
                    />
                  </div>
                  <div className="flex justify-between text-xs text-base-content/40 font-mono">
                    <span>0</span>
                    <span>100 MAX</span>
                  </div>
                </div>

                <div className="flex items-center justify-center gap-2 text-success text-sm font-medium">
                  <CheckCircle className="w-4 h-4" />
                  <span>Identity confirmed by GEORISE Security Protocol</span>
                </div>
              </motion.div>
            )}

            {/* ─── STATE B: PENDING ─── */}
            {currentStatus === 'PENDING' && (
              <motion.div
                key="pending"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="card bg-base-100/50 backdrop-blur-xl border border-warning/30 shadow-[0_0_30px_rgba(251,191,36,0.1)] p-8 text-center space-y-6"
              >
                {/* Radar Spinner */}
                <div className="relative flex justify-center py-4">
                  <motion.div
                    animate={{ scale: [1, 1.3, 1], opacity: [0.4, 0, 0.4] }}
                    transition={{ duration: 2, repeat: Infinity }}
                    className="absolute w-28 h-28 rounded-full border-2 border-warning/40"
                  />
                  <div className="relative p-6 bg-warning/10 rounded-full border border-warning/30">
                    <Clock className="w-14 h-14 text-warning" />
                  </div>
                </div>

                <div>
                  <h2 className="text-xl font-black text-warning mb-2">
                    {t('verify.verification_pending', 'Verification Pending')}
                  </h2>
                  <p className="text-sm text-base-content/60 font-mono">Scanning Documents...</p>
                </div>

                {/* Status Alert */}
                <div className="alert bg-warning/10 border border-warning/30 text-warning text-sm text-left">
                  <Clock className="w-4 h-4 shrink-0" />
                  <div>
                    <div className="font-bold">Review In Progress</div>
                    <div className="text-xs opacity-80">
                      Your documents are being reviewed by the GEORISE security team. This usually
                      takes 1–2 business days.
                    </div>
                  </div>
                </div>

                {/* Step tracker */}
                <ol className="steps steps-vertical text-left text-sm w-full">
                  <li className="step step-success">Documents Uploaded</li>
                  <li className="step step-warning">Security Review</li>
                  <li className="step">Identity Confirmation</li>
                  <li className="step">Access Granted</li>
                </ol>
              </motion.div>
            )}

            {/* ─── STATE A / REJECTED ─── */}
            {(currentStatus === null || currentStatus === 'REJECTED') && (
              <motion.div key="form" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                {/* Rejection banner */}
                {currentStatus === 'REJECTED' && (
                  <motion.div
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="alert alert-error mb-6 shadow-lg text-sm"
                  >
                    <AlertTriangle className="w-5 h-5 shrink-0" />
                    <div>
                      <div className="font-bold">Verification Rejected</div>
                      <div className="text-xs">
                        {user?.verificationRequest?.reviewNote ??
                          'Please resubmit with clearer documents.'}
                      </div>
                    </div>
                  </motion.div>
                )}

                <form
                  onSubmit={handleSubmit}
                  className="card bg-base-100/60 backdrop-blur-xl border border-base-content/10 shadow-xl p-8 space-y-6"
                >
                  <div>
                    <h2 className="text-lg font-bold text-base-content mb-1">
                      {currentStatus === 'REJECTED'
                        ? 'Re-submit Documents'
                        : 'KYC Authorization Form'}
                    </h2>
                    <p className="text-xs text-base-content/50 font-mono">
                      Provide your National ID to upgrade your clearance level.
                    </p>
                  </div>

                  {/* Error alert */}
                  <AnimatePresence>
                    {error && (
                      <motion.div
                        initial={{ opacity: 0, y: -8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        className="alert alert-error text-sm"
                      >
                        <AlertTriangle className="w-4 h-4 shrink-0" />
                        <span>{error}</span>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* National ID Number */}
                  <div className="form-control">
                    <label className="label">
                      <span className="label-text text-xs font-semibold uppercase tracking-wider text-base-content/50">
                        {t('verify.national_id_number', 'National ID Number')}
                      </span>
                    </label>
                    <label className="input input-bordered flex items-center gap-3 bg-base-200/50 focus-within:ring-2 ring-primary/50 border-none h-12">
                      <FileText className="w-5 h-5 text-base-content/40 shrink-0" />
                      <input
                        type="text"
                        className="grow bg-transparent outline-none text-base-content font-mono tracking-widest"
                        placeholder="ETH-XXXXXXXXX"
                        value={idNumber}
                        onChange={(e) => setIdNumber(e.target.value.toUpperCase())}
                        required
                      />
                    </label>
                  </div>

                  {/* ID Photo Upload */}
                  <div className="form-control">
                    <label className="label">
                      <span className="label-text text-xs font-semibold uppercase tracking-wider text-base-content/50">
                        ID Photo Upload
                      </span>
                    </label>
                    <div
                      onClick={() => fileRef.current?.click()}
                      className={`relative border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all ${
                        file
                          ? 'border-primary/60 bg-primary/5'
                          : 'border-base-content/20 bg-base-200/30 hover:bg-base-200/60 hover:border-primary/40'
                      }`}
                    >
                      {filePreview ? (
                        <img
                          src={filePreview}
                          alt="Preview"
                          className="max-h-36 mx-auto rounded-lg object-contain"
                        />
                      ) : (
                        <div className="flex flex-col items-center gap-3 text-base-content/40">
                          <Upload className="w-10 h-10" />
                          <div>
                            <p className="text-sm font-semibold">Click to upload</p>
                            <p className="text-xs">JPG, PNG up to 5MB</p>
                          </div>
                        </div>
                      )}
                      <input
                        ref={fileRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleFileChange}
                      />
                    </div>
                    {file && (
                      <p className="text-xs text-base-content/50 mt-2 font-mono">
                        ✓ {file.name} ({(file.size / 1024).toFixed(0)} KB)
                      </p>
                    )}
                  </div>

                  {/* Submit */}
                  <button
                    type="submit"
                    disabled={submitting || !idNumber.trim() || !file}
                    className="btn btn-primary w-full h-12 text-base shadow-[0_0_20px_rgba(59,130,246,0.4)] hover:shadow-[0_0_30px_rgba(59,130,246,0.6)] hover:scale-[1.02] transition-all disabled:scale-100 disabled:shadow-none"
                  >
                    {submitting ? (
                      <span className="flex items-center gap-2">
                        <span className="loading loading-spinner loading-sm" />
                        Initiating Authorized Sequence...
                      </span>
                    ) : (
                      <span className="flex items-center gap-2">
                        <ShieldCheck className="w-5 h-5" />
                        Submit for Verification
                      </span>
                    )}
                  </button>

                  <p className="text-center text-xs text-base-content/40">
                    Your data is encrypted and processed securely. GEORISE does not share identity
                    documents with third parties.
                  </p>
                </form>
              </motion.div>
            )}
          </AnimatePresence>
        )}
      </div>
    </AppLayout>
  );
};

export default CitizenVerificationPage;
