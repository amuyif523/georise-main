import React, { useEffect, useState } from "react";
import AppLayout from "../../layouts/AppLayout";
import api from "../../lib/api";
import TrustBadge from "../../components/user/TrustBadge";

type Pending = {
  id: number;
  userId: number;
  nationalId: string;
  phone: string;
  status: string;
  user: { id: number; fullName: string; email: string; trustScore: number };
};

const VerificationPage: React.FC = () => {
  const [pending, setPending] = useState<Pending[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const res = await api.get("/verification/pending");
    setPending(res.data || []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const decide = async (userId: number, decision: "APPROVE" | "REJECT") => {
    await api.post(`/verification/${userId}/decision`, { decision });
    await load();
  };

  return (
    <AppLayout>
      <div className="p-6 space-y-4">
        <div>
          <p className="text-sm text-cyan-200">Admin</p>
          <h1 className="text-2xl font-bold text-white">Pending Citizen Verifications</h1>
        </div>
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
                  <div className="text-xs text-slate-400">National ID: {p.nationalId}</div>
                  <div className="text-xs text-slate-400">Phone: {p.phone}</div>
                  <div className="mt-1">
                    <TrustBadge trustScore={p.user.trustScore ?? 0} />
                  </div>
                </div>
                <div className="flex gap-2">
                  <button className="btn btn-xs" onClick={() => decide(p.user.id, "APPROVE")}>
                    Approve
                  </button>
                  <button className="btn btn-xs btn-outline" onClick={() => decide(p.user.id, "REJECT")}>
                    Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default VerificationPage;
