import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api',
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('georise_token');
  if (token) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Attach retryAfterMs to 429 errors so callers can back off
api.interceptors.response.use(
  (res) => res,
  (error) => {
    if (error?.response?.status === 429) {
      const retryAfterHeader = error.response.headers?.['retry-after'];
      const retrySeconds = retryAfterHeader ? Number(retryAfterHeader) : NaN;
      if (!Number.isNaN(retrySeconds)) {
        error.retryAfterMs = retrySeconds * 1000;
      }
    }
    return Promise.reject(error);
  },
);



(api as any).getIncidentChat = (id: number) => api.get(`/incidents/${id}/chat`);
(api as any).postChatMessage = (id: number, message: string) =>
  api.post(`/incidents/${id}/chat`, { message });
(api as any).getAgencies = () => api.get('/agencies'); // Add this line
(api as any).shareIncident = (
  id: number,
  targetAgencyId: number,
  reason: string,
  note?: string,
) => api.post(`/incidents/${id}/collaborate`, { targetAgencyId, reason, note });

export default api;
