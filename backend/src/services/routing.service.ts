import axios from 'axios';

const OSRM_BASE_URL =
  process.env.OSRM_BASE_URL || 'https://router.project-osrm.org/route/v1/driving';

export class RoutingService {
  /**
   * Calculate driving distance and duration between two points using OSRM.
   * @param startLat Latitude of starting point
   * @param startLon Longitude of starting point
   * @param endLat Latitude of destination
   * @param endLon Longitude of destination
   * @returns Object containing distance in km and duration in minutes
   */
  async calculateRoute(
    startLat: number,
    startLon: number,
    endLat: number,
    endLon: number,
  ): Promise<{ distanceKm: number | null; durationMin: number; geometry?: any }> {
    try {
      // OSRM expects: /startLon,startLat;endLon,endLat
      const url = `${OSRM_BASE_URL}/${startLon},${startLat};${endLon},${endLat}?overview=full&geometries=geojson`;

      const response = await axios.get(url, { timeout: 3000 });

      if (response.data?.code === 'Ok' && response.data?.routes?.length > 0) {
        const route = response.data.routes[0];
        // OSRM returns distance in meters, duration in seconds
        return {
          distanceKm: route.distance / 1000,
          durationMin: route.duration / 60,
          geometry: route.geometry,
        };
      }
    } catch (error) {
      console.warn('OSRM routing failed, falling back to Euclidean:', (error as Error).message);
    }

    // Fallback: Return null distance so pure Euclidean can be used, or just 0 duration
    return { distanceKm: null, durationMin: 0 };
  }
}

export const routingService = new RoutingService();
