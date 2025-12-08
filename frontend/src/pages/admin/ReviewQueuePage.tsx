/* eslint-disable react-hooks/set-state-in-effect */
import React, { useEffect, useState } from "react";
import AppLayout from "../../layouts/AppLayout";
import api from "../../lib/api";
import TrustBadge from "../../components/user/TrustBadge";

type ReviewIncident = {
  id: number;
  title: string;
  category: string | null;
  status: string;
  reviewStatus: string;
  createdAt: string;
  reporter: { id: number; fullName: string; trustScore: number } | null;
};

const ReviewQueuePage: React.FC = () => {
  const [incidents, setIncidents] = useState<ReviewIncident[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const res = await api.get("/incidents", { params: { reviewStatus: "PENDING_REVIEW" } });
    setIncidents(res.data.incidents || []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const decide = async (id: number, decision: "APPROVE" | "REJECT") => {
    await api.post(`/incidents/${id}/review`, { decision });
    await load();
  };

  return (
    <AppLayout>
      <div className="p-6 space-y-4">
        <div>
          <p className="text-sm text-cyan-200">Admin</p>
          <h1 className="text-2xl font-bold text-white">Review Queue</h1>
          <p className="text-slate-400 text-sm">Low-trust or unverified reports pending approval.</p>
        </div>
        {loading ? (
          <div className="text-slate-300">Loading…</div>
        ) : incidents.length === 0 ? (
          <div className="text-slate-400 text-sm">No incidents awaiting review.</div>
        ) : (
          <div className="space-y-2">
            {incidents.map((i) => (
              <div
                key={i.id}
                className="p-4 rounded-xl border border-slate-800 bg-[#0D1117] flex justify-between items-center"
              >
                <div>
                  <div className="text-lg text-white font-semibold">{i.title}</div>
                  <div className="text-xs text-slate-400">
                    {i.category || "Uncategorized"} • {new Date(i.createdAt).toLocaleString()}
                  </div>
                  <div className="text-xs text-slate-400 flex gap-2 items-center mt-1">
                    Reporter: {i.reporter?.fullName || "Unknown"}
                    {i.reporter && <TrustBadge trustScore={i.reporter.trustScore} />}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button className="btn btn-xs" onClick={() => decide(i.id, "APPROVE")}>
                    Approve
                  </button>
                  <button className="btn btn-xs btn-outline" onClick={() => decide(i.id, "REJECT")}>
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

export default ReviewQueuePage;
