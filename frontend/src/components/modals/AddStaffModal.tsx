import React, { useState } from 'react';
import { X, UserPlus, Loader2 } from 'lucide-react'; // icons
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

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      await api.post('/agency/users', formData);
      toast.success('Staff member added successfully!');
      setFormData({ fullName: '', email: '', phone: '', staffRole: 'RESPONDER' });
      onSuccess();
      onClose();
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
            <UserPlus className="w-5 h-5 text-indigo-400" />
            Add Staff Member
          </h3>
          <button
            onClick={onClose}
            className="rounded-full p-1 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
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
                onChange={(e) => setFormData({ ...formData, staffRole: e.target.value })}
              >
                <option value="RESPONDER">Responder (Field Unit)</option>
                <option value="DISPATCHER">Dispatcher (Operator)</option>
                <option value="SUPERVISOR">Supervisor (Admin)</option>
              </select>
              {/* Custom Arrow */}
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
              onClick={onClose}
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
      </div>
    </div>
  );
};

export default AddStaffModal;
