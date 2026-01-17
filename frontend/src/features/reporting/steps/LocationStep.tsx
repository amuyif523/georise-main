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

const LocationClickHandler: React.FC<{ onSelect: (lat: number, lng: number) => void }> = ({ onSelect }) => {
    useMapEvents({
        click(e) { onSelect(e.latlng.lat, e.latlng.lng); },
    });
    return null;
};

export const LocationStep: React.FC<{ onNext: () => void; onBack: () => void }> = ({ onNext, onBack }) => {
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
                    <LocationClickHandler onSelect={(lat, lng) => updateDraft({ latitude: lat, longitude: lng })} />
                    {draft.latitude && draft.longitude && (
                        <Marker position={[draft.latitude, draft.longitude]} icon={wizardIcon} />
                    )}
                </MapContainer>

                <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-base-100/90 backdrop-blur px-6 py-2 rounded-full shadow-xl border border-base-content/10 z-[1000] flex items-center gap-2">
                    <Target className="w-4 h-4 text-primary animate-pulse" />
                    <span className="font-bold text-sm">Pinpoint Location</span>
                </div>

                <div className="absolute bottom-8 left-0 right-0 p-4 z-[1000] flex justify-center gap-4">
                    <button className="btn btn-circle bg-base-100" onClick={onBack}><ArrowLeft /></button>
                    <button
                        className="btn btn-primary px-8 shadow-lg shadow-primary/30"
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
