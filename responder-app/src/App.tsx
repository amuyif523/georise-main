import React, { useEffect, useState } from "react";
import api from "./lib/api";
import { connectSocket, disconnectSocket, getSocket } from "./lib/socket";
import { useNetworkStatus } from "./hooks/useNetworkStatus";
import { useLocationTracker } from "./hooks/useLocationTracker";
import NetworkBanner from "./components/NetworkBanner";
import InstallAppBanner from "./components/InstallAppBanner";
import LoginForm from "./components/LoginForm";
import { MapPin, Navigation2, CheckCircle, AlertCircle } from "lucide-react";

type Incident = {
  id: number;
  title: string;
  latitude?: number | null;
  longitude?: number | null;
  status?: string;
};

const App: React.FC = () => {
  const [token, setToken] = useState<string | null>(localStorage.getItem("responder_token"));
  const [activeIncident, setActiveIncident] = useState<Incident | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const online = useNetworkStatus();
  const coords = useLocationTracker();

  const handleLogin = async (email: string, password: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.post("/auth/login", { email, password });
      const t = res.data.token;
      
      // Verify role
      if (res.data.user.role !== "AGENCY_STAFF" && res.data.user.role !== "ADMIN") {
        throw new Error("Unauthorized: Only agency staff can access this app.");
      }

      localStorage.setItem("responder_token", t);
      setToken(t);
      connectSocket(t);
      setMessage("Connected as responder.");
    } catch (err: any) {
      setError(err?.response?.data?.message || err.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    localStorage.removeItem("responder_token");
    disconnectSocket();
    setToken(null);
    setActiveIncident(null);
  };

  useEffect(() => {
    if (token) {
      connectSocket(token);
    }
  }, [token]);

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;
    const onAssigned = (payload: any) => {
      setActiveIncident({ id: payload.incidentId, title: payload.title, latitude: payload.latitude, longitude: payload.longitude, status: "ASSIGNED" });
      setMessage("New assignment received.");
    };
    const onArrival = (payload: any) => {
      if (activeIncident && payload.incidentId === activeIncident.id) {
        setActiveIncident({ ...activeIncident, status: "RESPONDING" });
      }
    };
    socket.on("incident:assignedResponder", onAssigned);
    socket.on("incident:arrival", onArrival);
    return () => {
      socket.off("incident:assignedResponder", onAssigned);
      socket.off("incident:arrival", onArrival);
    };
  }, [activeIncident]);

  const openMaps = () => {
    if (!activeIncident?.latitude || !activeIncident.longitude) return;
    window.open(
      `https://www.google.com/maps/dir/?api=1&destination=${activeIncident.latitude},${activeIncident.longitude}`
    );
  };

  const markResolved = async () => {
    if (!activeIncident) return;
    if (!confirm("Mark incident resolved?")) return;
    try {
      await api.patch(`/incidents/${activeIncident.id}/resolve`, { note: "Resolved by responder" });
      setActiveIncident({ ...activeIncident, status: "RESOLVED" });
      setMessage("Incident marked resolved.");
    } catch (err: any) {
      setError(err?.response?.data?.message || "Failed to resolve");
    }
  };

  if (!token) {
    return <LoginForm onLogin={handleLogin} loading={loading} error={error} />;
  }

  return (
    <div className="min-h-screen bg-[#020617] text-slate-100 flex flex-col">
      <NetworkBanner />
      <InstallAppBanner />
      <header className="px-4 py-3 border-b border-slate-800 flex items-center justify-between">
        <div>
          <div className="text-[11px] text-slate-400">GEORISE Responder</div>
          <div className="text-sm font-semibold">On Duty</div>
        </div>
        <button className="btn btn-xs btn-outline text-slate-400 hover:text-white" onClick={logout}>Logout</button>
      </header>

      <main className="flex-1 p-4 flex flex-col gap-4 max-w-md mx-auto w-full">


        {token && (
          <>
            {message && <div className="alert alert-info text-xs">{message}</div>}
            {error && <div className="alert alert-error text-xs">{error}</div>}

            <div className="card p-4 space-y-2">
              <div className="text-xs text-slate-400">Your location</div>
              {coords ? (
                <div className="flex items-center gap-2 text-sm">
                  <MapPin className="w-4 h-4 text-cyan-300" />
                  <div>
                    <div>{coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}</div>
                    <div className="text-[11px] text-slate-500">{online ? "Online" : "Offline (queued)"}</div>
                  </div>
                </div>
              ) : (
                <div className="text-xs text-slate-500">Waiting for GPS…</div>
              )}
            </div>

            <div className="card p-4 space-y-3">
              <div className="text-xs text-slate-400">Active incident</div>
              {activeIncident ? (
                <>
                  <div className="text-sm font-semibold">{activeIncident.title}</div>
                  <div className="flex items-center gap-2 text-xs text-slate-400">
                    <AlertCircle className="w-4 h-4 text-orange-400" />
                    <span>Status: {activeIncident.status || "ASSIGNED"}</span>
                  </div>
                  <div className="flex gap-2 pt-2">
                    <button className="btn btn-primary btn-lg flex-1" onClick={openMaps}>
                      <Navigation2 className="w-4 h-4" /> Navigate
                    </button>
                    <button className="btn btn-success btn-lg flex-1" onClick={markResolved}>
                      <CheckCircle className="w-4 h-4" /> Resolve
                    </button>
                  </div>
                </>
              ) : (
                <div className="text-xs text-slate-500">No active assignment.</div>
              )}
            </div>
          </>
        )}
      </main>
    </div>
  );
};

export default App;
