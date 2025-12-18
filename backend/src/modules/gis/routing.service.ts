import axios from 'axios';
import redis from '../../redis';
import logger from '../../logger';
import {
  GOOGLE_ROUTES_API_KEY,
  OSRM_BASE_URL,
  ROUTING_CACHE_TTL_SECONDS,
  ROUTING_FALLBACK_PROVIDER,
  ROUTING_PROVIDER,
  ROUTING_TIMEOUT_MS,
} from '../../config/env';

interface RouteResult {
  distanceKm: number;
  durationMin: number;
  provider: string;
  cached?: boolean;
}

export class RoutingService {
  private cacheKey(
    provider: string,
    startLat: number,
    startLng: number,
    endLat: number,
    endLng: number,
  ) {
    // rounding reduces cache-key explosion but keeps meter-level accuracy (~11m at 4 decimals)
    const round = (v: number) => v.toFixed(4);
    return `route:${provider}:${round(startLat)}:${round(startLng)}:${round(endLat)}:${round(
      endLng,
    )}`;
  }

  async calculateRoute(
    startLat: number,
    startLng: number,
    endLat: number,
    endLng: number,
  ): Promise<RouteResult> {
    const provider = ROUTING_PROVIDER;
    const key = this.cacheKey(provider, startLat, startLng, endLat, endLng);

    // Return cached result if present
    try {
      const cached = await redis.get(key);
      if (cached) {
        const parsed = JSON.parse(cached) as RouteResult;
        return { ...parsed, cached: true };
      }
    } catch (err) {
      logger.warn({ err }, 'Routing cache read failed');
    }

    let result: RouteResult | null = null;
    try {
      if (provider === 'osrm') {
        result = await this.fetchOsrm(startLat, startLng, endLat, endLng);
      } else if (provider === 'google') {
        result = await this.fetchGoogle(startLat, startLng, endLat, endLng);
      }
    } catch (err) {
      logger.error({ err }, 'Routing provider failed, will fallback');
    }

    if (!result) {
      result = this.heuristic(startLat, startLng, endLat, endLng, provider);
    }

    // Cache best-effort
    try {
      await redis.setex(key, ROUTING_CACHE_TTL_SECONDS, JSON.stringify(result));
    } catch (err) {
      logger.warn({ err }, 'Routing cache write failed');
    }

    return result;
  }

  private async fetchOsrm(
    startLat: number,
    startLng: number,
    endLat: number,
    endLng: number,
  ): Promise<RouteResult> {
    const url = `${OSRM_BASE_URL}/${startLng},${startLat};${endLng},${endLat}?overview=false&alternatives=false`;
    const res = await axios.get(url, { timeout: ROUTING_TIMEOUT_MS });
    const route = res.data?.routes?.[0];
    if (!route) throw new Error('No OSRM route returned');
    return {
      distanceKm: parseFloat((route.distance / 1000).toFixed(2)),
      durationMin: parseFloat((route.duration / 60).toFixed(1)),
      provider: 'osrm',
    };
  }

  private async fetchGoogle(
    startLat: number,
    startLng: number,
    endLat: number,
    endLng: number,
  ): Promise<RouteResult> {
    if (!GOOGLE_ROUTES_API_KEY) {
      throw new Error('GOOGLE_ROUTES_API_KEY not set');
    }

    // Using the Directions REST endpoint keeps dependencies light
    const url = 'https://maps.googleapis.com/maps/api/directions/json';
    const params = {
      origin: `${startLat},${startLng}`,
      destination: `${endLat},${endLng}`,
      mode: 'driving',
      key: GOOGLE_ROUTES_API_KEY,
    };
    const res = await axios.get(url, { params, timeout: ROUTING_TIMEOUT_MS });
    const leg = res.data?.routes?.[0]?.legs?.[0];
    if (!leg) throw new Error('No Google route returned');
    return {
      distanceKm: parseFloat((leg.distance.value / 1000).toFixed(2)),
      durationMin: parseFloat((leg.duration.value / 60).toFixed(1)),
      provider: 'google',
    };
  }

  private heuristic(
    startLat: number,
    startLng: number,
    endLat: number,
    endLng: number,
    failedProvider: string,
  ): RouteResult {
    const dist = this.getDistanceFromLatLonInKm(startLat, startLng, endLat, endLng);
    // Urban drive-time heuristic: 25 km/h average, tortuosity 1.4
    const averageSpeedKmH = 25;
    const tortuosity = 1.4;
    const estimatedRoadDist = dist * tortuosity;
    const durationHours = estimatedRoadDist / averageSpeedKmH;

    logger.warn(
      { provider: failedProvider },
      'Routing falling back to heuristic (linear * tortuosity)',
    );

    return {
      distanceKm: parseFloat(estimatedRoadDist.toFixed(2)),
      durationMin: parseFloat((durationHours * 60).toFixed(1)),
      provider: ROUTING_FALLBACK_PROVIDER || 'heuristic',
    };
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
