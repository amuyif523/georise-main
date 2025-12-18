import logger from '../../logger';

interface RouteResult {
  distanceKm: number;
  durationMin: number;
}

export class RoutingService {
  // In a real deployment, this would point to a local OSRM instance or Google Routes API
  // private OSRM_URL = process.env.OSRM_URL || "http://router.project-osrm.org/route/v1/driving";

  /**
   * Calculates route between two points.
   * Currently uses a heuristic fallback since we don't have a guaranteed OSRM server.
   * In production, uncomment the API call logic.
   */
  async calculateRoute(
    startLat: number,
    startLng: number,
    endLat: number,
    endLng: number,
  ): Promise<RouteResult> {
    try {
      // Haversine distance (linear)
      const dist = this.getDistanceFromLatLonInKm(startLat, startLng, endLat, endLng);

      // Heuristic for urban drive time:
      // Average speed in Addis Ababa ~ 20-30 km/h due to traffic
      // Tortuosity factor (road vs linear distance) ~ 1.4
      const averageSpeedKmH = 25;
      const tortuosity = 1.4;

      const estimatedRoadDist = dist * tortuosity;
      const durationHours = estimatedRoadDist / averageSpeedKmH;

      return {
        distanceKm: parseFloat(estimatedRoadDist.toFixed(2)),
        durationMin: parseFloat((durationHours * 60).toFixed(0)),
      };

      /* 
      // Real OSRM Implementation Example:
      const url = `${this.OSRM_URL}/${startLng},${startLat};${endLng},${endLat}?overview=false`;
      const res = await axios.get(url);
      if (res.data.routes && res.data.routes.length > 0) {
        const route = res.data.routes[0];
        return {
          distanceKm: route.distance / 1000,
          durationMin: route.duration / 60
        };
      }
      */
    } catch (err) {
      logger.error({ err }, 'Routing service failed, falling back to linear');
      return { distanceKm: 0, durationMin: 0 };
    }
  }

  private getDistanceFromLatLonInKm(lat1: number, lon1: number, lat2: number, lon2: number) {
    const R = 6371; // Radius of the earth in km
    const dLat = this.deg2rad(lat2 - lat1);
    const dLon = this.deg2rad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.deg2rad(lat1)) *
        Math.cos(this.deg2rad(lat2)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const d = R * c; // Distance in km
    return d;
  }

  private deg2rad(deg: number) {
    return deg * (Math.PI / 180);
  }
}

export const routingService = new RoutingService();
