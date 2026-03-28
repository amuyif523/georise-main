export interface IncidentListItem {
  id: number;
  title: string;
  category: string | null;
  severityScore: number | null;
  isUnverified?: boolean;
  status: string;
  createdAt: string;
  resolutionPhotoUrl?: string | null;
  photos?: { url: string }[];
  subCityId?: number | null;
  assignedAgencyId?: number | null;
  sharedWith?: { agencyId: number }[];
}
