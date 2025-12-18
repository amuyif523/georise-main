import React, { useMemo, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { MapContainer, Marker, TileLayer, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { Map, MessageSquare, ShieldCheck, AlertTriangle, Construction } from 'lucide-react';
import api from '../lib/api';
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import { addToIncidentQueue } from '../offline/incidentQueue';
import { useSystem } from '../context/SystemContext';
import { useTranslation } from 'react-i18next';

type Step = 1 | 2 | 3;

type WizardForm = {
  title: string;
  description: string;
  latitude?: number;
  longitude?: number;
  image?: File | null;
  notAtScene?: boolean;
};

const defaultCenter: [number, number] = [9.03, 38.74];

const wizardIcon = new L.Icon.Default({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const StepPill: React.FC<{ active: boolean; label: string; icon: React.ReactNode }> = ({
  active,
  label,
  icon,
}) => (
  <div
    className={`flex items-center gap-2 px-4 py-2 rounded-full border ${
      active ? 'border-cyan-400 bg-cyan-400/10 text-cyan-200' : 'border-slate-700 text-slate-400'
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
}> = ({ form, setForm, onNext, error }) => {
  const { crisisMode } = useSystem();
  const { t } = useTranslation();

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm text-cyan-200">Step 1</p>
          <h2 className="text-2xl font-bold text-white">{t('incident.report_new')}</h2>
          <p className="text-slate-400 text-sm mt-1">
            Add a clear title and description so dispatch can understand quickly.
          </p>
        </div>
      </div>
      {crisisMode && (
        <div className="alert alert-error text-sm font-bold animate-pulse">
          <AlertTriangle size={20} />
          <span>
            CRISIS MODE ACTIVE: Please only report life-threatening emergencies. Minor issues will
            be deprioritized.
          </span>
        </div>
      )}
      {error && <div className="alert alert-error text-sm">{error}</div>}
      <div className="space-y-3">
        <div>
          <label className="label">
            <span className="label-text text-slate-200">{t('incident.type')} / Title</span>
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
            <span className="label-text text-slate-200">{t('incident.description')}</span>
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
      <div className="flex justify-between items-center pt-4">
        <Link
          to="/citizen/report-hazard"
          className="text-sm text-slate-400 hover:text-warning flex items-center gap-2 transition-colors"
        >
          <Construction size={16} />
          Report Infrastructure Hazard
        </Link>
        <button className="btn btn-primary" onClick={onNext}>
          Continue to location
        </button>
      </div>
    </div>
  );
};

const Step2Location: React.FC<{
  form: WizardForm;
  setForm: React.Dispatch<React.SetStateAction<WizardForm>>;
  onNext: () => void;
  onBack: () => void;
  error: string | null;
}> = ({ form, setForm, onNext, onBack, error }) => {
  const { t } = useTranslation();
  const center = useMemo<[number, number]>(() => {
    if (form.latitude && form.longitude) return [form.latitude, form.longitude];
    return defaultCenter;
  }, [form.latitude, form.longitude]);

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm text-cyan-200">Step 2</p>
          <h2 className="text-2xl font-bold text-white">{t('incident.location')}</h2>
          <p className="text-slate-400 text-sm mt-1">
            Click on the map to pin the approximate spot.
          </p>
        </div>
      </div>
      {error && <div className="alert alert-error text-sm">{error}</div>}
      <div className="rounded-xl border border-slate-800 overflow-hidden shadow-lg shadow-cyan-500/10">
        <MapContainer center={center} zoom={13} className="w-full h-80" scrollWheelZoom>
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          <LocationSelector
            onSelect={(lat, lng) => setForm((prev) => ({ ...prev, latitude: lat, longitude: lng }))}
          />
          {form.latitude && form.longitude && (
            <Marker position={[form.latitude, form.longitude]} icon={wizardIcon} />
          )}
        </MapContainer>
      </div>
      <p className="text-sm text-slate-300">
        {form.latitude && form.longitude
          ? `Selected location: ${form.latitude.toFixed(5)}, ${form.longitude.toFixed(5)}`
          : 'Click anywhere on the map to set the incident location.'}
      </p>

      <div className="form-control">
        <label className="label cursor-pointer justify-start gap-3">
          <input
            type="checkbox"
            className="checkbox checkbox-primary"
            checked={form.notAtScene || false}
            onChange={(e) => setForm((prev) => ({ ...prev, notAtScene: e.target.checked }))}
          />
          <span className="label-text text-slate-200">
            I am not at the scene (reduces location confidence)
          </span>
        </label>
      </div>

      <div>
        <label className="label">
          <span className="label-text text-slate-200">Attach image (optional)</span>
        </label>
        <input
          type="file"
          accept="image/*"
          className="file-input file-input-bordered w-full max-w-xs"
          onChange={(e) => {
            const file = e.target.files?.[0] || null;
            setForm((prev) => ({ ...prev, image: file }));
          }}
        />
      </div>
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
        <p className="text-sm text-cyan-200">{form.title || 'No title'}</p>
        <p className="text-sm text-slate-300 mt-2">{form.description || 'No description'}</p>
      </div>
      <div className="p-4 rounded-lg border border-slate-800 bg-slate-900/60">
        <h3 className="text-lg font-semibold text-white mb-2">Location</h3>
        <p className="text-sm text-slate-300">
          {form.latitude && form.longitude
            ? `${form.latitude.toFixed(5)}, ${form.longitude.toFixed(5)}`
            : 'No location set'}
        </p>
        {form.image && (
          <p className="text-xs text-slate-500 mt-2">Image attached: {form.image.name}</p>
        )}
      </div>
    </div>
    <div className="flex justify-between">
      <button className="btn btn-ghost" onClick={onBack}>
        Back
      </button>
      <button className={`btn btn-primary ${submitting ? 'loading' : ''}`} onClick={onSubmit}>
        {submitting ? 'Submitting...' : 'Submit incident'}
      </button>
    </div>
  </div>
);

const ReportIncidentWizard: React.FC = () => {
  const [step, setStep] = useState<Step>(1);
  const [form, setForm] = useState<WizardForm>({ title: '', description: '' });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const navigate = useNavigate();
  const online = useNetworkStatus();

  const handleNextFromStep1 = () => {
    if (!form.title || !form.description) {
      setError('Please provide a title and description.');
      return;
    }
    setError(null);
    setStep(2);
  };

  const handleNextFromStep2 = async () => {
    if (form.latitude == null || form.longitude == null) {
      setError('Please select a location on the map.');
      return;
    }
    setError(null);

    // Check for duplicates
    if (online) {
      try {
        const res = await api.get('/incidents/duplicates', {
          params: {
            lat: form.latitude,
            lng: form.longitude,
            title: form.title,
            description: form.description,
          },
        });
        const duplicates = res.data.duplicates || [];
        if (duplicates.length > 0) {
          const confirmMsg = `We found ${duplicates.length} similar report(s) nearby. Are you sure you want to submit a new one?`;
          if (!window.confirm(confirmMsg)) return;
        }
      } catch (err) {
        console.warn('Failed to check duplicates', err);
      }
    }

    setStep(3);
  };

  const handleSubmit = async () => {
    try {
      setSubmitting(true);
      setError(null);
      const payload = {
        ...form,
        isReporterAtScene: !form.notAtScene,
      };
      if (online) {
        const res = await api.post('/incidents', payload);
        const incidentId = res.data?.incident?.id;

        if (incidentId && form.image) {
          const fd = new FormData();
          fd.append('photo', form.image);
          try {
            await api.post(`/incidents/${incidentId}/photos`, fd, {
              headers: { 'Content-Type': 'multipart/form-data' },
            });
          } catch (uploadErr) {
            console.warn('Photo upload failed', uploadErr);
            setInfo('Incident submitted, but photo upload failed. You can retry from My Reports.');
          }
        }

        navigate('/citizen/my-reports');
      } else {
        await addToIncidentQueue(payload);
        setInfo(
          'You are offline. Your report has been queued and will auto-send when back online.',
        );
      }
    } catch {
      await addToIncidentQueue(form);
      setInfo('Network issue. Your report has been queued and will sync when online.');
    } finally {
      setSubmitting(false);
    }
  };

  const isMobile = typeof window !== 'undefined' ? window.innerWidth < 768 : false;

  return (
    <div
      className={`min-h-screen bg-[#0A0F1A] text-slate-100 pt-16 pb-12 ${
        isMobile ? 'fixed inset-0 overflow-y-auto z-30 bg-[#0A0F1A]/95' : ''
      }`}
    >
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
            <Step1Describe
              form={form}
              setForm={setForm}
              onNext={handleNextFromStep1}
              error={error}
            />
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
