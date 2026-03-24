/* eslint-disable react-hooks/set-state-in-effect */
import React, { useEffect, useState } from 'react';
import AppLayout from '../../layouts/AppLayout';
import api from '../../lib/api';
import TrustBadge from '../../components/user/TrustBadge';

const ADMIN_USERS_INVALIDATED_EVENT = 'georise:admin-users-invalidated';

type Pending = {
  id: number;
  userId: number;
  idNumber: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  user: {
    id: number;
    fullName: string;
    email: string;
    phone?: string | null;
    trustScore?: number;
    isVerified?: boolean;
  };
};

const VerificationPage: React.FC = () => {
  const [pending, setPending] = useState<Pending[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const res = await api.get('/admin/verify-requests');
    setPending((res.data.requests || []).filter((request: Pending) => !request.user?.isVerified));
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const decide = async (requestId: number, status: 'APPROVED' | 'REJECTED') => {
    await api.patch(`/admin/verify-request/${requestId}`, { status });
    window.dispatchEvent(new CustomEvent(ADMIN_USERS_INVALIDATED_EVENT));
    await load();
  };

  return (
    <AppLayout>
      {loading ? (
        <div className="text-slate-300">Loading…</div>
      ) : pending.length === 0 ? (
        <div className="text-slate-400 text-sm">No pending verifications.</div>
      ) : (
        <div className="space-y-2">
          {pending.map((p) => (
            <div
              key={p.id}
              className="p-4 rounded-xl border border-slate-800 bg-[#0D1117] flex justify-between items-center"
            >
              <div>
                <div className="text-white font-semibold">{p.user.fullName}</div>
                <div className="text-xs text-slate-400">{p.user.email}</div>
                <div className="text-xs text-slate-400">National ID: {p.idNumber}</div>
                <div className="text-xs text-slate-400">Phone: {p.user.phone ?? 'N/A'}</div>
                <div className="mt-1">
                  <TrustBadge trustScore={p.user.trustScore ?? 0} />
                </div>
              </div>
              <div className="flex gap-2">
                <button className="btn btn-xs" onClick={() => decide(p.id, 'APPROVED')}>
                  Approve
                </button>
                <button
                  className="btn btn-xs btn-outline"
                  onClick={() => decide(p.id, 'REJECTED')}
                >
                  Reject
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </AppLayout>
  );
};

export default VerificationPage;
