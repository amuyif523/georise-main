import React, { useState } from 'react';
import { X, UserPlus, Loader2, ShieldAlert, KeyRound, Copy, CheckCircle2 } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../lib/api';

interface AddStaffModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const AddStaffModal: React.FC<AddStaffModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    phone: '',
    staffRole: 'RESPONDER',
  });
  const [isLoading, setIsLoading] = useState(false);
  const [createdStaffData, setCreatedStaffData] = useState<{ email: string; otp: string } | null>(
    null,
  );

  if (!isOpen) return null;

  const handleClose = () => {
    setCreatedStaffData(null);
    setFormData({ fullName: '', email: '', phone: '', staffRole: 'RESPONDER' });
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const res = await api.post('/agency/users', formData);
      toast.success('Staff member added successfully!');
      onSuccess();
      setCreatedStaffData({
        email: res.data?.staff?.email || formData.email,
        otp: res.data?.cleartextOtp || '',
      });
    } catch (error: any) {
      console.error(error);
      const msg = error.response?.data?.message || 'Failed to add staff member';
      toast.error(msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 transition-all">
      <div
        className="w-full max-w-md transform overflow-hidden rounded-2xl bg-slate-900 border border-slate-700 shadow-2xl transition-all animate-in fade-in zoom-in duration-200"
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-700/50 p-6">
          <h3 className="text-xl font-bold text-white flex items-center gap-2">
            {createdStaffData ? (
              <ShieldAlert className="w-5 h-5 text-emerald-400" />
            ) : (
              <UserPlus className="w-5 h-5 text-indigo-400" />
            )}
            {createdStaffData ? 'Provisioning Complete' : 'Add Staff Member'}
          </h3>
          <button
            onClick={handleClose}
            className="rounded-full p-1 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {createdStaffData ? (
          <div className="p-6 space-y-6">
            <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-5">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="mt-0.5 h-5 w-5 text-emerald-300" />
                <div>
                  <h4 className="text-lg font-semibold text-white">Staff Member Created Successfully!</h4>
                  <p className="mt-1 text-sm text-slate-300">
                    Share these demo credentials with the staff member for their first login.
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-700 bg-[#0b1220] p-5 shadow-inner">
              <div className="mb-4 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.22em] text-cyan-300">
                <KeyRound className="h-4 w-4" />
                Tactical Provisioning Output
              </div>

              <div className="space-y-4 font-mono">
                <div>
                  <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Email</div>
                  <div className="mt-2 break-all rounded-xl border border-slate-800 bg-slate-950 px-4 py-3 text-lg text-slate-100">
                    {createdStaffData.email}
                  </div>
                </div>

                <div>
                  <div className="text-xs uppercase tracking-[0.18em] text-slate-500">
                    One-Time Passcode
                  </div>
                  <div className="mt-2 rounded-xl border border-cyan-500/20 bg-slate-950 px-4 py-4 text-center text-3xl tracking-[0.35em] text-cyan-300">
                    {createdStaffData.otp}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(createdStaffData.otp);
                    toast.success('OTP copied to clipboard');
                  } catch (_error) {
                    toast.error('Failed to copy OTP');
                  }
                }}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-600 bg-slate-800 px-4 py-2 text-sm font-medium text-slate-200 transition hover:bg-slate-700"
              >
                <Copy className="h-4 w-4" />
                Copy OTP
              </button>
              <button
                type="button"
                onClick={handleClose}
                className="rounded-lg bg-gradient-to-r from-emerald-600 to-cyan-500 px-5 py-2 text-sm font-medium text-white shadow-lg transition hover:scale-105"
              >
                Done
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 space-y-5">
            {/* Full Name */}
            <div className="relative group">
              <input
                type="text"
                id="fullName"
                className="peer w-full rounded-lg border border-slate-600 bg-slate-800/50 px-4 pt-3 pb-3 text-sm text-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all placeholder-transparent"
                placeholder="Full Name"
                value={formData.fullName}
                onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                required
              />
              <label
                htmlFor="fullName"
                className="absolute left-4 top-2 text-xs text-slate-400 transition-all 
                         peer-placeholder-shown:top-3.5 peer-placeholder-shown:text-base peer-placeholder-shown:text-slate-500
                         peer-focus:top-2 peer-focus:text-xs peer-focus:text-indigo-400"
              >
                Full Name
              </label>
            </div>

            {/* Email */}
            <div className="relative group">
              <input
                type="email"
                id="email"
                className="peer w-full rounded-lg border border-slate-600 bg-slate-800/50 px-4 pt-3 pb-3 text-sm text-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all placeholder-transparent"
                placeholder="Email Address"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                required
              />
              <label
                htmlFor="email"
                className="absolute left-4 top-2 text-xs text-slate-400 transition-all 
                         peer-placeholder-shown:top-3.5 peer-placeholder-shown:text-base peer-placeholder-shown:text-slate-500
                         peer-focus:top-2 peer-focus:text-xs peer-focus:text-indigo-400"
              >
                Email Address
              </label>
            </div>

            {/* Phone */}
            <div className="relative group">
              <input
                type="tel"
                id="phone"
                className="peer w-full rounded-lg border border-slate-600 bg-slate-800/50 px-4 pt-3 pb-3 text-sm text-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all placeholder-transparent"
                placeholder="Phone Number"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                required
              />
              <label
                htmlFor="phone"
                className="absolute left-4 top-2 text-xs text-slate-400 transition-all 
                         peer-placeholder-shown:top-3.5 peer-placeholder-shown:text-base peer-placeholder-shown:text-slate-500
                         peer-focus:top-2 peer-focus:text-xs peer-focus:text-indigo-400"
              >
                Phone Number
              </label>
            </div>

            {/* Role Select */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-400 ml-1">Assign Role</label>
              <div className="relative">
                <select
                  className="w-full appearance-none rounded-lg border border-slate-600 bg-slate-800/50 px-4 py-3 text-sm text-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all cursor-pointer"
                  value={formData.staffRole}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, staffRole: e.target.value }))
                  }
                >
                  <option value="RESPONDER">Responder (Field Unit)</option>
                  <option value="DISPATCHER">Dispatcher (Operator)</option>
                  <option value="SUPERVISOR">Supervisor (Admin)</option>
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-slate-400">
                  <svg
                    className="h-4 w-4 fill-current"
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 20 20"
                  >
                    <path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" />
                  </svg>
                </div>
              </div>
            </div>

            {/* Footer Actions */}
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-700/50 mt-6">
              <button
                type="button"
                onClick={handleClose}
                className="px-4 py-2 text-sm font-medium text-slate-300 hover:text-white transition-colors hover:bg-slate-800 rounded-lg"
                disabled={isLoading}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isLoading}
                className="relative overflow-hidden rounded-lg bg-gradient-to-r from-indigo-600 to-blue-500 px-6 py-2 text-sm font-medium text-white shadow-lg transition-all hover:scale-105 hover:from-indigo-500 hover:to-blue-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-slate-900 disabled:opacity-70 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  'Create Account'
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default AddStaffModal;
