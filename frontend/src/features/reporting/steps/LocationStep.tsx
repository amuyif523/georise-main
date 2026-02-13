import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import { ArrowLeft, ArrowRight, Target } from 'lucide-react';
import L from 'leaflet';
import { useReportContext } from '../ReportWizardContext';

// Fix icon
const wizardIcon = new L.Icon.Default({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const LocationClickHandler: React.FC<{ onSelect: (lat: number, lng: number) => void }> = ({
  onSelect,
}) => {
  useMapEvents({
    click(e) {
      onSelect(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
};

const LocateControl: React.FC<{ onLocationFound: (lat: number, lng: number) => void }> = ({
  onLocationFound,
}) => {
  const map = useMapEvents({});
  const [locating, setLocating] = React.useState(false);

  const handleLocate = () => {
    setLocating(true);
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser');
      setLocating(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        onLocationFound(latitude, longitude);
        map.flyTo([latitude, longitude], 15, {
          animate: true,
          duration: 1.5,
        });
        setLocating(false);
      },
      () => {
        alert('Unable to retrieve your location. Please check browser permissions.');
        setLocating(false);
      },
    );
  };

  return (
    <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[1000]">
      <button
        onClick={handleLocate}
        disabled={locating}
        className="btn btn-sm glass gap-2 rounded-full shadow-lg border-base-content/10 hover:bg-base-100/90 text-base-content"
      >
        {locating ? (
          <span className="loading loading-spinner loading-xs"></span>
        ) : (
          <Target className="w-4 h-4 text-primary animate-pulse" />
        )}
        <span className="font-bold text-xs">{locating ? 'Locating...' : 'Use My Location'}</span>
      </button>
    </div>
  );
};

export const LocationStep: React.FC<{ onNext: () => void; onBack: () => void }> = ({
  onNext,
  onBack,
}) => {
  const { draft, updateDraft } = useReportContext();

  const center = useMemo<[number, number]>(() => {
    if (draft.latitude && draft.longitude) return [draft.latitude, draft.longitude];
    return [9.03, 38.74]; // Default Addis Ababa
  }, [draft.latitude, draft.longitude]);

  return (
    <motion.div
      initial={{ opacity: 0, x: 50 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -50 }}
      className="w-full h-full absolute inset-0 pt-16 flex flex-col"
    >
      <div className="flex-1 relative">
        <MapContainer center={center} zoom={13} className="w-full h-full">
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          <LocationClickHandler
            onSelect={(lat, lng) => {
              updateDraft({ latitude: lat, longitude: lng });
            }}
          />
          <LocateControl
            onLocationFound={(lat, lng) => {
              updateDraft({ latitude: lat, longitude: lng });
            }}
          />
          {draft.latitude && draft.longitude && (
            <Marker position={[draft.latitude, draft.longitude]} icon={wizardIcon} />
          )}
        </MapContainer>

        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[10000] w-full max-w-md px-4 flex justify-center gap-4 pointer-events-none">
          <button
            className="btn btn-circle bg-base-100 pointer-events-auto shadow-lg"
            onClick={onBack}
          >
            <ArrowLeft />
          </button>
          <button
            className={`px-8 py-3 rounded-full font-bold shadow-xl pointer-events-auto transition-all duration-300 flex items-center gap-2 ${
              draft.latitude
                ? 'bg-blue-600 text-white hover:bg-blue-700 scale-105 ring-4 ring-blue-500/30'
                : 'bg-gray-400 text-gray-200 cursor-not-allowed'
            }`}
            onClick={onNext}
            disabled={!draft.latitude}
          >
            Confirm Location <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </motion.div>
  );
};
