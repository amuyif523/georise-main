export interface CreateIncidentRequest {
  title: string;
  description: string;
  latitude?: number;
  longitude?: number;
}

export interface IncidentListItem {
  id: number;
  title: string;
  category: string | null;
  severityScore: number | null;
  status: string;
  latitude: number | null;
  longitude: number | null;
  createdAt: string;
}
