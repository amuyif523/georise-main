import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { MapContainer, Marker, TileLayer, useMapEvents } from "react-leaflet";
import L from "leaflet";
import { Map, MessageSquare, ShieldCheck } from "lucide-react";
import api from "../lib/api";

type Step = 1 | 2 | 3;

type WizardForm = {
  title: string;
  description: string;
  latitude?: number;
  longitude?: number;
};

const defaultCenter: [number, number] = [9.03, 38.74];

const wizardIcon = new L.Icon.Default({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

const StepPill: React.FC<{ active: boolean; label: string; icon: React.ReactNode }> = ({
  active,
  label,
  icon,
}) => (
  <div
    className={`flex items-center gap-2 px-4 py-2 rounded-full border ${
      active ? "border-cyan-400 bg-cyan-400/10 text-cyan-200" : "border-slate-700 text-slate-400"
    }`}
  >
    <span className="w-5 h-5 text-cyan-300">{icon}</span>
    <span className="text-sm font-medium">{label}</span>
  </div>
);

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

const Step1Describe: React.FC<{
  form: WizardForm;
  setForm: React.Dispatch<React.SetStateAction<WizardForm>>;
  onNext: () => void;
  error: string | null;
}> = ({ form, setForm, onNext, error }) => (
  <div className="space-y-4">
    <div className="flex items-start justify-between gap-3">
      <div>
        <p className="text-sm text-cyan-200">Step 1</p>
        <h2 className="text-2xl font-bold text-white">Describe the incident</h2>
        <p className="text-slate-400 text-sm mt-1">
          Add a clear title and description so dispatch can understand quickly.
        </p>
      </div>
    </div>
    {error && <div className="alert alert-error text-sm">{error}</div>}
    <div className="space-y-3">
      <div>
        <label className="label">
          <span className="label-text text-slate-200">Title</span>
        </label>
        <input
          className="input input-bordered w-full bg-slate-900 border-slate-700 text-white"
          value={form.title}
          onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
          placeholder="e.g. እሳት በወሎ ላይ"
        />
      </div>
      <div>
        <label className="label">
          <span className="label-text text-slate-200">Description</span>
        </label>
        <textarea
          className="textarea textarea-bordered w-full min-h-[120px] bg-slate-900 border-slate-700 text-white"
          value={form.description}
          onChange={(e) =>
            setForm((prev) => ({
              ...prev,
              description: e.target.value,
            }))
          }
          placeholder="Add key details, language can be Amharic/English."
        />
      </div>
    </div>
    <div className="flex justify-end">
      <button className="btn btn-primary" onClick={onNext}>
        Continue to location
      </button>
    </div>
  </div>
);

const Step2Location: React.FC<{
  form: WizardForm;
  setForm: React.Dispatch<React.SetStateAction<WizardForm>>;
  onNext: () => void;
  onBack: () => void;
  error: string | null;
}> = ({ form, setForm, onNext, onBack, error }) => {
  const center = useMemo<[number, number]>(() => {
    if (form.latitude && form.longitude) return [form.latitude, form.longitude];
    return defaultCenter;
  }, [form.latitude, form.longitude]);

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm text-cyan-200">Step 2</p>
          <h2 className="text-2xl font-bold text-white">Choose location</h2>
          <p className="text-slate-400 text-sm mt-1">
            Click on the map to pin the approximate spot.
          </p>
        </div>
      </div>
      {error && <div className="alert alert-error text-sm">{error}</div>}
      <div className="rounded-xl border border-slate-800 overflow-hidden shadow-lg shadow-cyan-500/10">
        <MapContainer
          center={center}
          zoom={13}
          className="w-full h-80"
          scrollWheelZoom
        >
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          <LocationSelector
            onSelect={(lat, lng) =>
              setForm((prev) => ({ ...prev, latitude: lat, longitude: lng }))
            }
          />
          {form.latitude && form.longitude && (
            <Marker position={[form.latitude, form.longitude]} icon={wizardIcon} />
          )}
        </MapContainer>
      </div>
      <p className="text-sm text-slate-300">
        {form.latitude && form.longitude
          ? `Selected location: ${form.latitude.toFixed(5)}, ${form.longitude.toFixed(5)}`
          : "Click anywhere on the map to set the incident location."}
      </p>
      <div className="flex justify-between">
        <button className="btn btn-ghost" onClick={onBack}>
          Back
        </button>
        <button className="btn btn-primary" onClick={onNext}>
          Review & submit
        </button>
      </div>
    </div>
  );
};

const Step3Review: React.FC<{
  form: WizardForm;
  onBack: () => void;
  onSubmit: () => void;
  submitting: boolean;
  error: string | null;
}> = ({ form, onBack, onSubmit, submitting, error }) => (
  <div className="space-y-4">
    <div className="flex items-start justify-between gap-3">
      <div>
        <p className="text-sm text-cyan-200">Step 3</p>
        <h2 className="text-2xl font-bold text-white">Review & submit</h2>
        <p className="text-slate-400 text-sm mt-1">
          Confirm the details before sending to dispatch.
        </p>
      </div>
    </div>
    {error && <div className="alert alert-error text-sm">{error}</div>}
    <div className="grid gap-4 md:grid-cols-2">
      <div className="p-4 rounded-lg border border-slate-800 bg-slate-900/60">
        <h3 className="text-lg font-semibold text-white mb-2">Summary</h3>
        <p className="text-sm text-cyan-200">{form.title || "No title"}</p>
        <p className="text-sm text-slate-300 mt-2">{form.description || "No description"}</p>
      </div>
      <div className="p-4 rounded-lg border border-slate-800 bg-slate-900/60">
        <h3 className="text-lg font-semibold text-white mb-2">Location</h3>
        <p className="text-sm text-slate-300">
          {form.latitude && form.longitude
            ? `${form.latitude.toFixed(5)}, ${form.longitude.toFixed(5)}`
            : "No location set"}
        </p>
      </div>
    </div>
    <div className="flex justify-between">
      <button className="btn btn-ghost" onClick={onBack}>
        Back
      </button>
      <button className={`btn btn-primary ${submitting ? "loading" : ""}`} onClick={onSubmit}>
        {submitting ? "Submitting..." : "Submit incident"}
      </button>
    </div>
  </div>
);

const ReportIncidentWizard: React.FC = () => {
  const [step, setStep] = useState<Step>(1);
  const [form, setForm] = useState<WizardForm>({ title: "", description: "" });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const navigate = useNavigate();

  const handleNextFromStep1 = () => {
    if (!form.title || !form.description) {
      setError("Please provide a title and description.");
      return;
    }
    setError(null);
    setStep(2);
  };

  const handleNextFromStep2 = () => {
    if (form.latitude == null || form.longitude == null) {
      setError("Please select a location on the map.");
      return;
    }
    setError(null);
    setStep(3);
  };

  const handleSubmit = async () => {
    try {
      setSubmitting(true);
      setError(null);
      if (!navigator.onLine) {
        const queue = JSON.parse(localStorage.getItem("georise_offline_queue") || "[]");
        queue.push({ type: "incident", payload: form, createdAt: new Date().toISOString() });
        localStorage.setItem("georise_offline_queue", JSON.stringify(queue));
        setInfo("Offline detected. Your report is queued and will auto-send when back online.");
        setSubmitting(false);
        navigate("/citizen/my-reports");
        return;
      }

      await api.post("/incidents", form);
      navigate("/citizen/my-reports");
    } catch (err: any) {
      setError(err?.response?.data?.message || "Failed to submit incident.");
    } finally {
      setSubmitting(false);
    }
  };

  // Auto-sync queued incidents when online
  React.useEffect(() => {
    const syncQueue = async () => {
      const raw = localStorage.getItem("georise_offline_queue");
      if (!raw) return;
      const queue = JSON.parse(raw);
      const remaining: any[] = [];
      for (const item of queue) {
        if (item.type === "incident") {
          try {
            await api.post("/incidents", item.payload);
          } catch {
            remaining.push(item);
          }
        }
      }
      if (remaining.length === 0) {
        localStorage.removeItem("georise_offline_queue");
      } else {
        localStorage.setItem("georise_offline_queue", JSON.stringify(remaining));
      }
    };
    window.addEventListener("online", syncQueue);
    return () => window.removeEventListener("online", syncQueue);
  }, []);

  return (
    <div className="min-h-screen bg-[#0A0F1A] text-slate-100 pt-16 pb-12">
      {!navigator.onLine && (
        <div className="w-full bg-warning text-black text-center text-xs py-2">
          Offline mode: your report will be queued and synced when you reconnect.
        </div>
      )}
      <div className="max-w-5xl mx-auto px-4">
        <div className="flex items-center gap-3">
          <StepPill active={step === 1} label="Describe" icon={<MessageSquare size={18} />} />
          <div className="h-px w-10 bg-slate-700" />
          <StepPill active={step === 2} label="Location" icon={<Map size={18} />} />
          <div className="h-px w-10 bg-slate-700" />
          <StepPill active={step === 3} label="Review" icon={<ShieldCheck size={18} />} />
        </div>

        <div className="mt-8 p-6 bg-[#0D1117] border border-slate-800 rounded-xl shadow-2xl shadow-cyan-500/10">
          {info && <div className="alert alert-info text-sm mb-3">{info}</div>}
          {step === 1 && (
            <Step1Describe form={form} setForm={setForm} onNext={handleNextFromStep1} error={error} />
          )}
          {step === 2 && (
            <Step2Location
              form={form}
              setForm={setForm}
              onNext={handleNextFromStep2}
              onBack={() => setStep(1)}
              error={error}
            />
          )}
          {step === 3 && (
            <Step3Review
              form={form}
              onBack={() => setStep(2)}
              onSubmit={handleSubmit}
              submitting={submitting}
              error={error}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default ReportIncidentWizard;
