import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { MapContainer, Marker, TileLayer, useMapEvents } from "react-leaflet";
import L from "leaflet";
import { Construction, ArrowLeft } from "lucide-react";
import api from "../lib/api";
import { useNetworkStatus } from "../hooks/useNetworkStatus";
import { addToIncidentQueue } from "../offline/incidentQueue";

type HazardForm = {
  description: string;
  latitude?: number;
  longitude?: number;
};

const defaultCenter: [number, number] = [9.03, 38.74];

const hazardIcon = new L.Icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

const LocationSelector: React.FC<{
  onSelect: (lat: number, lng: number) => void;
}> = ({ onSelect }) => {
  useMapEvents({
    click(e) {
      onSelect(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
};

const ReportHazardPage: React.FC = () => {
  const navigate = useNavigate();
  const online = useNetworkStatus();
  
  const [step, setStep] = useState<1 | 2>(1);
  const [form, setForm] = useState<HazardForm>({
    description: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const center = useMemo<[number, number]>(() => {
    if (form.latitude && form.longitude) return [form.latitude, form.longitude];
    return defaultCenter;
  }, [form.latitude, form.longitude]);

  const handleSubmit = async () => {
    if (!form.latitude || !form.longitude) {
      setError("Please select a location on the map.");
      return;
    }
    setLoading(true);
    setError(null);

    const payload = {
      title: "Infrastructure Hazard",
      description: form.description,
      latitude: form.latitude,
      longitude: form.longitude,
      category: "INFRASTRUCTURE",
      isReporterAtScene: true,
    };

    try {
      if (online) {
        await api.post("/incidents", payload);
      } else {
        await addToIncidentQueue(payload);
      }
      navigate("/citizen/my-reports");
    } catch (err) {
      console.error(err);
      const e = err as { response?: { data?: { message?: string } } };
      setError(e?.response?.data?.message || "Failed to submit report");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0A0F1A] text-slate-200 flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-slate-800 flex items-center gap-3 bg-[#0D1117]">
        <button onClick={() => navigate(-1)} className="btn btn-ghost btn-sm btn-square">
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-lg font-bold flex items-center gap-2">
          <Construction className="text-warning" />
          Report Infrastructure Hazard
        </h1>
      </div>

      <div className="flex-1 p-4 max-w-2xl mx-auto w-full">
        {/* Progress */}
        <div className="flex justify-center mb-6">
          <ul className="steps w-full">
            <li className={`step ${step >= 1 ? "step-warning" : ""}`}>Describe</li>
            <li className={`step ${step >= 2 ? "step-warning" : ""}`}>Location</li>
          </ul>
        </div>

        {error && <div className="alert alert-error mb-4">{error}</div>}

        {step === 1 && (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="bg-slate-900/50 p-4 rounded-lg border border-slate-800">
              <h2 className="text-xl font-bold text-white mb-2">What is the issue?</h2>
              <p className="text-slate-400 text-sm mb-4">
                Report potholes, broken streetlights, water leaks, or other non-emergency infrastructure problems.
              </p>
              
              <div className="form-control">
                <label className="label">
                  <span className="label-text text-slate-300">Description</span>
                </label>
                <textarea
                  className="textarea textarea-bordered h-32 bg-slate-950 border-slate-700 text-white"
                  placeholder="e.g. Large pothole on the main road causing traffic slowdown..."
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                ></textarea>
              </div>
            </div>

            <div className="flex justify-end">
              <button 
                className="btn btn-warning"
                disabled={!form.description.trim()}
                onClick={() => setStep(2)}
              >
                Next: Location
              </button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="bg-slate-900/50 p-4 rounded-lg border border-slate-800">
              <h2 className="text-xl font-bold text-white mb-2">Where is it?</h2>
              <p className="text-slate-400 text-sm mb-4">
                Tap on the map to pin the exact location of the hazard.
              </p>

              <div className="h-80 rounded-lg overflow-hidden border border-slate-700 relative z-0">
                <MapContainer
                  center={center}
                  zoom={15}
                  className="w-full h-full"
                >
                  <TileLayer
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                  />
                  <LocationSelector
                    onSelect={(lat, lng) => setForm({ ...form, latitude: lat, longitude: lng })}
                  />
                  {form.latitude && form.longitude && (
                    <Marker position={[form.latitude, form.longitude]} icon={hazardIcon} />
                  )}
                </MapContainer>
              </div>
              
              {form.latitude && (
                <p className="text-xs text-slate-500 mt-2 text-center">
                  Selected: {form.latitude.toFixed(5)}, {form.longitude?.toFixed(5)}
                </p>
              )}
            </div>

            <div className="flex justify-between">
              <button className="btn btn-ghost" onClick={() => setStep(1)}>
                Back
              </button>
              <button 
                className={`btn btn-warning ${loading ? "loading" : ""}`}
                disabled={!form.latitude || loading}
                onClick={handleSubmit}
              >
                Submit Report
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ReportHazardPage;
