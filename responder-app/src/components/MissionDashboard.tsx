import React from 'react';
import { AlertCircle, Clock3, Image as ImageIcon, MapPinned, Navigation2, Radar, ShieldCheck } from 'lucide-react';

type IncidentPhoto = {
  id: number;
  url: string;
  originalName?: string | null;
};

type Incident = {
  id: number;
  title: string;
  description?: string | null;
  category?: string | null;
  severityScore?: number | null;
  status?: string;
  acknowledgedAt?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  photos?: IncidentPhoto[];
};

type MissionDashboardProps = {
  incident: Incident | null;
  online: boolean;
  responderCoords: { lat: number; lng: number } | null;
  landmark: string | null;
  severityLabel: string;
  getPhotoUrl: (path?: string | null) => string | null;
  accepting: boolean;
  onAcceptMission: () => Promise<void>;
  onStartMission: () => Promise<void>;
  onGoToMap: () => void;
  onOpenMaps: () => void;
};

const MissionDashboard: React.FC<MissionDashboardProps> = ({
  incident,
  online,
  responderCoords,
  landmark,
  severityLabel,
  getPhotoUrl,
  accepting,
  onAcceptMission,
  onStartMission,
  onGoToMap,
  onOpenMaps,
}) => {
  const canAccept = Boolean(incident && incident.status === 'ASSIGNED' && !incident.acknowledgedAt);
  const canStart =
    Boolean(incident) &&
    (!incident?.status || ['ASSIGNED', 'EN_ROUTE'].includes(incident.status));

  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col gap-4 p-4 pb-40">
      <section className="card p-4 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Mission Dashboard</div>
            <div className="mt-1 text-lg font-semibold text-slate-100">
              {incident ? incident.title : 'Standing By'}
            </div>
          </div>
          <div className="rounded-full border border-slate-700 bg-slate-900 px-3 py-1 text-[11px] text-slate-300">
            {incident ? incident.status || 'ASSIGNED' : online ? 'AVAILABLE' : 'OFFLINE'}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 text-xs">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-3">
            <div className="text-slate-500">AI Category</div>
            <div className="mt-1 font-semibold text-orange-200">{incident?.category || 'UNCLASSIFIED'}</div>
          </div>
          <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-3">
            <div className="text-slate-500">Severity</div>
            <div className="mt-1 font-semibold text-cyan-200">{severityLabel}</div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-3 text-sm text-slate-200">
          {incident?.description || 'No active assignment. Keep the map nearby and remain available for dispatch.'}
        </div>

        {landmark && (
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <MapPinned className="h-4 w-4 text-cyan-300" />
            <span>{landmark}</span>
          </div>
        )}

        <div className="flex items-center gap-2 text-xs text-slate-400">
          <Radar className="h-4 w-4 text-emerald-300" />
          <span>
            {responderCoords
              ? `${responderCoords.lat.toFixed(5)}, ${responderCoords.lng.toFixed(5)}`
              : 'Awaiting GPS lock'}
          </span>
        </div>
      </section>

      {incident?.photos && incident.photos.length > 0 && (
        <section className="card p-4 space-y-3">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <ImageIcon className="h-4 w-4 text-cyan-300" />
            <span>Citizen Evidence</span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {incident.photos.map((photo) => {
              const photoUrl = getPhotoUrl(photo.url);
              return (
                <a
                  key={photo.id}
                  href={photoUrl || '#'}
                  target="_blank"
                  rel="noreferrer"
                  className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900"
                >
                  {photoUrl ? (
                    <img
                      src={photoUrl}
                      alt={photo.originalName || 'Incident evidence'}
                      className="h-24 w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-24 items-center justify-center text-[11px] text-slate-500">
                      Photo unavailable
                    </div>
                  )}
                </a>
              );
            })}
          </div>
        </section>
      )}

      <section className="card p-4 space-y-3">
        <div className="text-xs text-slate-400">Actions</div>
        <button
          className="btn btn-success h-14 w-full text-base font-bold"
          disabled={!canAccept || accepting}
          onClick={() => {
            void onAcceptMission();
          }}
        >
          <ShieldCheck className="h-5 w-5" />
          {incident
            ? canAccept
              ? accepting
                ? 'ACCEPTING...'
                : 'ACCEPT MISSION'
              : incident.acknowledgedAt
                ? 'MISSION ACCEPTED'
                : 'ACCEPT UNAVAILABLE'
            : 'NO ACTIVE MISSION'}
        </button>

        <button
          className="btn btn-warning h-14 w-full text-base font-bold"
          disabled={!canStart}
          onClick={() => {
            void onStartMission();
          }}
        >
          <Clock3 className="h-5 w-5" />
          {incident ? 'START MISSION' : 'AWAITING DISPATCH'}
        </button>

        <button className="btn btn-primary h-16 w-full text-lg font-bold" onClick={onGoToMap}>
          <Navigation2 className="h-5 w-5" />
          GO TO MAP
        </button>

        <button
          className="btn btn-outline btn-info w-full"
          disabled={!incident?.latitude || !incident?.longitude}
          onClick={onOpenMaps}
        >
          <AlertCircle className="h-4 w-4" />
          Open in Google Maps
        </button>

        {!online && (
          <div className="rounded-xl border border-yellow-500/30 bg-yellow-500/10 px-3 py-2 text-xs text-yellow-100">
            Offline mode active. Mission actions may queue until connectivity returns.
          </div>
        )}

        {!incident && (
          <div className="rounded-xl border border-dashed border-slate-700 px-3 py-4 text-center text-xs text-slate-500">
            No active assignment yet. The tactical map remains available in standby mode.
          </div>
        )}
      </section>
    </div>
  );
};

export default MissionDashboard;
