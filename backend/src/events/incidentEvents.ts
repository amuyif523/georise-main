import { getIO } from '../socket';

export interface IncidentPayload {
  id: number;
  title: string;
  description: string;
  category: string | null;
  severityScore: number | null;
  status: string;
  latitude: number | null;
  longitude: number | null;
  reporterId: number | null;
  assignedAgencyId?: number | null;
  createdAt: string;
  updatedAt: string;
}

export const toIncidentPayload = (incident: any): IncidentPayload => ({
  id: incident.id,
  title: incident.title,
  description: incident.description,
  category: incident.category,
  severityScore: incident.severityScore,
  status: incident.status,
  latitude: incident.latitude,
  longitude: incident.longitude,
  reporterId: incident.reporterId,
  assignedAgencyId: incident.assignedAgencyId ?? null,
  createdAt:
    incident.createdAt instanceof Date ? incident.createdAt.toISOString() : incident.createdAt,
  updatedAt:
    incident.updatedAt instanceof Date ? incident.updatedAt.toISOString() : incident.updatedAt,
});

export const emitIncidentCreated = (incident: IncidentPayload) => {
  const io = getIO();
  if (incident.reporterId) {
    io.to(`user:${incident.reporterId}`).emit('incident:created', incident);
  }
  if (incident.assignedAgencyId) {
    io.to(`agency:${incident.assignedAgencyId}`).emit('incident:created', incident);
  }
  io.to('role:ADMIN').emit('incident:created', incident);
};

export const emitIncidentUpdated = (incident: IncidentPayload) => {
  const io = getIO();
  if (incident.reporterId) {
    io.to(`user:${incident.reporterId}`).emit('incident:updated', incident);
  }
  if (incident.assignedAgencyId) {
    io.to(`agency:${incident.assignedAgencyId}`).emit('incident:updated', incident);
  }
  io.to('role:ADMIN').emit('incident:updated', incident);
};

export const emitPendingIncidentToAgencies = (incident: IncidentPayload) => {
  const io = getIO();
  // Broadcast to all agency staff so they can see and claim the unassigned/pending incident
  io.to('role:AGENCY_STAFF').emit('incident:created', incident);
  io.to('role:ADMIN').emit('incident:created', incident);
};
