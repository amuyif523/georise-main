import React, { useEffect, useState } from "react";
import api from "../../lib/api";
import { 
  Database, 
  Server, 
  Cpu, 
  CheckCircle, 
  XCircle,
  RefreshCw
} from "lucide-react";

interface ServiceHealth {
  status: "up" | "down" | "unknown";
  latency: number;
}

interface SystemHealth {
  status: "ok" | "degraded";
  timestamp: string;
  services: {
    database: ServiceHealth;
    redis: ServiceHealth;
    ai: ServiceHealth;
  };
}

const SystemStatusPage: React.FC = () => {
  const [health, setHealth] = useState<SystemHealth | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchHealth = async () => {
    setLoading(true);
    try {
      const res = await api.get("/system/health");
      setHealth(res.data);
      setLastUpdated(new Date());
      setError(null);
    } catch (err) {
      console.error("Failed to fetch health", err);
      setError("Failed to fetch system health. Backend might be down.");
      setHealth(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHealth();
    const interval = setInterval(fetchHealth, 30000); // Poll every 30s
    return () => clearInterval(interval);
  }, []);

  const getStatusColor = (status: string) => {
    if (status === "up" || status === "ok") return "text-success";
    if (status === "down" || status === "degraded") return "text-error";
    return "text-warning";
  };

  const ServiceCard = ({ 
    title, 
    icon: Icon, 
    data 
  }: { 
    title: string; 
    icon: any; 
    data?: ServiceHealth 
  }) => (
    <div className="card bg-base-100 shadow-xl border border-base-200">
      <div className="card-body">
        <div className="flex justify-between items-start">
          <div className="flex items-center gap-3">
            <div className={`p-3 rounded-lg bg-base-200 ${getStatusColor(data?.status || "unknown")}`}>
              <Icon className="w-6 h-6" />
            </div>
            <div>
              <h3 className="card-title text-base">{title}</h3>
              <p className="text-xs text-base-content/70">
                Latency: {data?.latency ? `${data.latency}ms` : "N/A"}
              </p>
            </div>
          </div>
          {data ? (
            data.status === "up" ? (
              <CheckCircle className="w-6 h-6 text-success" />
            ) : (
              <XCircle className="w-6 h-6 text-error" />
            )
          ) : (
            <div className="loading loading-spinner loading-sm"></div>
          )}
        </div>
        <div className="mt-4">
          <div className="w-full bg-base-200 rounded-full h-2.5">
            <div 
              className={`h-2.5 rounded-full ${data?.status === "up" ? "bg-success" : "bg-error"}`} 
              style={{ width: "100%" }}
            ></div>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">System Status</h1>
          <p className="text-base-content/70">Real-time infrastructure monitoring</p>
        </div>
        <div className="flex items-center gap-4">
          {lastUpdated && (
            <span className="text-sm text-base-content/60">
              Last updated: {lastUpdated.toLocaleTimeString()}
            </span>
          )}
          <button 
            className="btn btn-ghost btn-circle"
            onClick={fetchHealth}
            disabled={loading}
          >
            <RefreshCw className={`w-5 h-5 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {error && (
        <div className="alert alert-error">
          <XCircle className="w-6 h-6" />
          <span>{error}</span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <ServiceCard 
          title="PostgreSQL Database" 
          icon={Database} 
          data={health?.services.database} 
        />
        <ServiceCard 
          title="Redis Cache" 
          icon={Server} 
          data={health?.services.redis} 
        />
        <ServiceCard 
          title="AI Classification Service" 
          icon={Cpu} 
          data={health?.services.ai} 
        />
      </div>

      <div className="card bg-base-100 shadow-xl border border-base-200">
        <div className="card-body">
          <h3 className="card-title">Overall System Health</h3>
          <div className="flex items-center gap-4 mt-2">
            <div className={`radial-progress ${getStatusColor(health?.status || "unknown")}`} style={{"--value": 100, "--size": "4rem"} as any}>
              {health?.status === "ok" ? "100%" : "ERR"}
            </div>
            <div>
              <div className="text-lg font-semibold uppercase tracking-wide">
                {health?.status || "Unknown"}
              </div>
              <div className="text-sm text-base-content/70">
                All systems operational
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SystemStatusPage;
