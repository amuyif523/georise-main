import React, { useEffect, useMemo, useState } from 'react';
import { MapContainer, TileLayer, useMap } from 'react-leaflet';
import { ArrowLeft, Camera, CheckCircle, Crosshair, MapPin, Navigation2 } from 'lucide-react';
import MapController from './tactical-map/MapController';
import ResponderMarker from './tactical-map/ResponderMarker';
import IncidentLayer from './tactical-map/IncidentLayer';
import RoutingLayer from './tactical-map/RoutingLayer';
import NearbyLayer from './tactical-map/NearbyLayer';

type ResponderCoords = { lat: number; lng: number; heading?: number | null };

type NearbyResponder = {
  id: number;
  name: string;
  status: string;
  latitude: number;
  longitude: number;
  user?: { id: number; fullName?: string | null } | null;
};

type TacticalMapProps = {
  visible: boolean;
  incidentTitle?: string | null;
  incidentStatus?: string | null;
  incidentLat?: number | null;
  incidentLng?: number | null;
  routeDist: number | null;
  routeEta: number | null;
  following: boolean;
  responderCoords: ResponderCoords | null;
  currentUserId?: number;
  nearbyResponders: NearbyResponder[];
  hasIncident: boolean;
  canResolve: boolean;
  closingPhoto: File | null;
  resolutionNotes: string;
  onBack: () => void;
  onOpenMaps: () => void;
  onToggleFollowing: () => void;
  onRecenter: () => void;
  onStartMission: () => void;
  onArrive: () => void;
  onResolve: () => void;
  onClosingPhotoChange: (file: File | null) => void;
  onResolutionNotesChange: (value: string) => void;
  onRouteData?: (distanceKm: number, durationMin: number) => void;
  recenterToken: number;
  finalReportVisible?: boolean;
};

const MapViewportSync = ({ visible }: { visible: boolean }) => {
  const map = useMap();

  useEffect(() => {
    if (!visible) return;
    const timeoutId = window.setTimeout(() => {
      map.invalidateSize({ animate: false });
    }, 200);
    return () => window.clearTimeout(timeoutId);
  }, [map, visible]);

  return null;
};

const TacticalMap: React.FC<TacticalMapProps> = ({
  visible,
  incidentTitle,
  incidentStatus,
  incidentLat,
  incidentLng,
  routeDist,
  routeEta,
  following,
  responderCoords,
  currentUserId,
  nearbyResponders,
  hasIncident,
  canResolve,
  closingPhoto,
  resolutionNotes,
  onBack,
  onOpenMaps,
  onToggleFollowing,
  onRecenter,
  onStartMission,
  onArrive,
  onResolve,
  onClosingPhotoChange,
  onResolutionNotesChange,
  onRouteData,
  recenterToken,
  finalReportVisible = false,
}) => {
  const [showSkeleton, setShowSkeleton] = useState(true);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => setShowSkeleton(false), 500);
    return () => window.clearTimeout(timeoutId);
  }, []);

  const standbyCenter = useMemo<[number, number]>(
    () => (responderCoords ? [responderCoords.lat, responderCoords.lng] : [9.0192, 38.7525]),
    [responderCoords],
  );

  const incidentCoords = useMemo(
    () =>
      incidentLat != null && incidentLng != null
        ? { lat: incidentLat, lng: incidentLng }
        : null,
    [incidentLat, incidentLng],
  );
  const resolutionReady = useMemo(
    () => Boolean(canResolve && closingPhoto && resolutionNotes.trim()),
    [canResolve, closingPhoto, resolutionNotes],
  );
  const isOnScene = incidentStatus === 'ARRIVED' || incidentStatus === 'ON_SCENE';
  const showNavigationControls = hasIncident && !isOnScene;

  return (
    <section
      className={`fixed inset-0 z-0 bg-slate-950 ${visible ? 'block' : 'hidden'}`}
      aria-hidden={!visible}
    >
      <div className="relative h-screen w-screen overflow-hidden">
        <MapContainer
          center={standbyCenter}
          zoom={14}
          zoomControl={false}
          className="fixed inset-0 z-0 h-screen w-screen bg-slate-900"
        >
          <MapViewportSync visible={visible} />
          <TileLayer
            url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
            attribution="&copy; OpenStreetMap contributors &copy; CARTO"
            updateWhenIdle={false}
            keepBuffer={8}
          />
          <MapController
            responderCoords={responderCoords ? { lat: responderCoords.lat, lng: responderCoords.lng } : null}
            incidentCoords={incidentCoords}
            following={following}
            visible={visible}
            recenterToken={recenterToken}
            finalReportVisible={finalReportVisible}
          />
          {responderCoords && (
            <ResponderMarker
              lat={responderCoords.lat}
              lng={responderCoords.lng}
              heading={responderCoords.heading}
            />
          )}
          {incidentCoords && <IncidentLayer lat={incidentCoords.lat} lng={incidentCoords.lng} />}
          <NearbyLayer nearbyResponders={nearbyResponders} currentUserId={currentUserId} />
          <RoutingLayer
            responderCoords={responderCoords ? { lat: responderCoords.lat, lng: responderCoords.lng } : null}
            incidentCoords={incidentCoords}
            onRouteData={onRouteData}
          />
        </MapContainer>

        {showSkeleton && (
          <div className="pointer-events-none absolute inset-0 z-[1100] bg-slate-950/70">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(148,163,184,0.14),transparent_24%),radial-gradient(circle_at_75%_30%,rgba(148,163,184,0.1),transparent_22%),linear-gradient(135deg,rgba(15,23,42,0.94),rgba(30,41,59,0.9))]" />
            <div className="absolute inset-0 opacity-25 [background-size:30px_30px] [background-image:linear-gradient(to_right,rgba(148,163,184,0.14)_1px,transparent_1px),linear-gradient(to_bottom,rgba(148,163,184,0.14)_1px,transparent_1px)]" />
          </div>
        )}

        <div className="tactical-hud pointer-events-none absolute inset-x-0 top-0 z-[1200]">
          <div className="absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-slate-950/90 via-slate-950/55 to-transparent" />
          <div className="relative px-4 pt-[max(1rem,env(safe-area-inset-top))]">
            <div className="pointer-events-auto flex items-start justify-between gap-3">
              <button className="btn btn-sm btn-neutral" onClick={onBack}>
                <ArrowLeft className="h-4 w-4" />
                Back to Dashboard
              </button>
              {showNavigationControls ? (
                <button className="btn btn-sm btn-info" disabled={!hasIncident} onClick={onOpenMaps}>
                  <Navigation2 className="h-4 w-4" />
                  Google Maps
                </button>
              ) : (
                <div />
              )}
            </div>

            <div className="pointer-events-auto mt-3 max-w-[82%] rounded-2xl border border-slate-700/80 bg-slate-950/72 px-4 py-3 text-white shadow-xl backdrop-blur-md">
              <div className="text-[11px] uppercase tracking-[0.18em] text-slate-400">
                {hasIncident ? 'Tactical Map' : 'Standby Map'}
              </div>
              <div className="mt-1 text-sm font-semibold text-slate-100">
                {incidentTitle || 'Awaiting Assignment'}
              </div>
              {hasIncident && routeDist !== null ? (
                <div className="mt-2 text-xs text-slate-300">
                  Distance <span className="font-mono text-cyan-300">{routeDist.toFixed(2)} km</span>
                  {'  '}ETA <span className="font-mono text-emerald-400">{Math.ceil(routeEta ?? 0)} min</span>
                </div>
              ) : (
                <div className="mt-2 flex items-center gap-2 text-xs text-slate-400">
                  <MapPin className="h-4 w-4 text-cyan-300" />
                  <span>
                    {responderCoords
                      ? `${responderCoords.lat.toFixed(5)}, ${responderCoords.lng.toFixed(5)}`
                      : 'Locating responder'}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="tactical-hud pointer-events-none absolute inset-x-0 bottom-0 z-[1200] px-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
          <div className="mx-auto flex max-w-md flex-col items-center gap-3">
            {!isOnScene && (
              <div className="pointer-events-auto flex items-center gap-2 rounded-full border border-slate-700/70 bg-slate-950/72 px-2 py-2 shadow-xl backdrop-blur-md">
                <button className="btn btn-sm btn-neutral" onClick={onRecenter}>
                  <Crosshair className="h-4 w-4" />
                  Recenter
                </button>
                <button className="btn btn-sm btn-neutral" onClick={onToggleFollowing}>
                  {following ? 'Free Pan' : 'Follow Me'}
                </button>
              </div>
            )}

            {hasIncident && (
              <div className="pointer-events-auto w-full max-h-[60vh] overflow-y-auto rounded-3xl border border-slate-700 bg-slate-950/90 p-4 shadow-2xl backdrop-blur">
                {incidentStatus === 'ASSIGNED' && (
                  <button
                    className="btn btn-info h-14 w-full text-base font-bold"
                    onClick={onStartMission}
                  >
                    <Navigation2 className="h-5 w-5" />
                    START MISSION
                  </button>
                )}

                {incidentStatus === 'RESPONDING' && (
                  <button
                    className="btn btn-primary h-14 w-full text-base font-bold"
                    disabled={!canResolve}
                    onClick={onArrive}
                  >
                    <MapPin className="h-5 w-5" />
                    {canResolve ? 'I HAVE ARRIVED' : 'ARRIVAL LOCKED'}
                  </button>
                )}

                {isOnScene && (
                  <div className="space-y-3">
                    <div className="text-xs uppercase tracking-[0.16em] text-slate-400">
                      Final Report
                    </div>
                    <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-3 text-xs text-slate-300">
                      Submit the after photo and the final responder notes to close the incident.
                    </div>
                    <div className="relative">
                      <input
                        type="file"
                        accept="image/*"
                        capture="environment"
                        onChange={(e) => onClosingPhotoChange(e.target.files?.[0] || null)}
                        className="file-input file-input-bordered file-input-success w-full"
                      />
                      {!closingPhoto && (
                        <Camera className="pointer-events-none absolute right-3 top-3 h-4 w-4 text-slate-400" />
                      )}
                    </div>
                    <textarea
                      className="textarea textarea-bordered min-h-[140px] w-full bg-slate-900 text-slate-100"
                      rows={5}
                      value={resolutionNotes}
                      onChange={(e) => onResolutionNotesChange(e.target.value)}
                      placeholder="Describe what was done, equipment used, hazards cleared, and whether follow-up is needed..."
                    />
                    <button
                      className="btn btn-success h-14 w-full text-base font-bold"
                      disabled={!resolutionReady}
                      onClick={onResolve}
                    >
                      <CheckCircle className="h-5 w-5" />
                      {!canResolve
                        ? 'GPS LOCK REQUIRED'
                        : !closingPhoto
                          ? 'EVIDENCE PHOTO REQUIRED'
                          : !resolutionNotes.trim()
                            ? 'RESOLUTION NOTES REQUIRED'
                            : 'MARK INCIDENT RESOLVED'}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};

export default TacticalMap;
